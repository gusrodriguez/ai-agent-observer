# AI Agent Observer

Observability toolkit for AI agent systems. Traces multi-agent workflows end-to-end, tracking which agents ran, what model tier they used, how many tokens they consumed, what they cost, and where they failed — with a web dashboard to inspect it all.

Built to solve a real problem: multi-agent orchestrators (LangChain, CrewAI, custom pipelines) are opaque at runtime. When an agent chain fails or costs spike, there's no structured way to see what happened inside. AI Agent Observer brings the same trace-and-span model used in distributed systems observability to AI agent workflows.

![Trace detail view showing a multi-agent debug session with span waterfall, model tier badges, and cost tracking](docs/observe.png)

## How it works

The observer provides two integration paths depending on how your agent system is built:

- **SDK** — for code-driven orchestrators (TypeScript applications, LangChain, custom pipelines). Import the package and call `startSpan` / `end` in your code.
- **MCP server** — for prompt-driven orchestrators (Claude Code, MCP-compatible agent systems). Add to `.mcp.json` and the LLM calls tracing tools directly.

Both push events to the same Redis Stream. An ingestion worker writes them to PostgreSQL. The dashboard reads from Postgres.

```
Code-driven agent (SDK)                  AI Agent Observer
┌─────────────────────┐
│  import { init }    │    XADD     ┌─────────────────┐
│  span.start(...)    │ ──────────> │                 │
│  span.end(...)      │             │   Redis Stream   │
└─────────────────────┘             │                 │
                                    └────────┬────────┘
Prompt-driven agent (MCP)                    │ XREADGROUP
┌─────────────────────┐             ┌────────▼────────┐
│  Claude Code        │    XADD     │ Ingestion Worker │
│  calls trace_start  │ ──────────> └────────┬────────┘
│  calls span_start   │                      │ Prisma
│  calls span_end     │             ┌────────▼────────┐
└─────────────────────┘             │   PostgreSQL     │
                                    └────────┬────────┘
                                             │ reads
                                    ┌────────▼────────┐
                                    │   Dashboard      │
                                    │   :3080          │
                                    └─────────────────┘
```

### Why both?

Agent systems fall into two camps. In **code-driven** systems (LangChain, CrewAI, custom TypeScript pipelines), you write application code that controls which agents run — the SDK fits naturally. In **prompt-driven** systems (Claude Code, OpenAI Assistants), the LLM itself is the orchestrator and there's no application code to import an SDK into — the MCP server exposes tracing as tools the LLM can call. Same pipeline underneath, different entry points.

### Why Redis Streams

Redis Streams provides consumer-group semantics (at-least-once delivery, acknowledgment, backpressure) in a single lightweight container. Kafka requires ZooKeeper/KRaft and a JVM runtime — significant operational overhead for an observability pipeline. Azure Service Bus is a managed cloud service that can't be self-hosted. Redis handles ~500k messages/sec on a single instance, more than sufficient for agent observability at any scale.

## What it tracks

| Concept | What it captures |
|---------|-----------------|
| **Traces** | One complete agent run — a debug session, a code review, a generation pipeline |
| **Spans** | One unit of work within a trace — an agent invocation, a tool call, an LLM request |
| **Nesting** | Parent-child relationships between spans — orchestrator spawns Scout, Scout calls search |
| **Model tiers** | Which model ran each span (haiku, sonnet, opus, gpt-4, etc.) |
| **Token usage** | Input and output token counts per span |
| **Cost** | Dollar cost per span, aggregated per trace |
| **Escalation** | When a cheap agent fails and a more capable one retries (Worker → Fixer → Specialist) |
| **Events** | Discrete happenings within a span — human checkpoints, approvals, escalation decisions |
| **Tool calls** | MCP tools, API calls, function invocations — input, output, success/failure, duration |
| **Status** | Success, failure, skipped, or still running — per span and per trace |

## Dashboard

### Trace detail

The core view. A waterfall visualization shows every span in a trace as a horizontal bar, nested by parent-child depth and positioned on a time axis.

### Trace list

All traces in reverse chronological order.

### Analytics

Aggregate statistics across all traces: total runs, success rate, average duration, and total spend. A cost breakdown chart shows spend by model tier (how much goes to haiku vs. sonnet vs. opus). An agent performance table lists every agent with its invocation count, average duration, average token usage, and total cost.

![Analytics view showing cost by model tier, escalation rate, and agent performance table](docs/observe_2.png)

## Integration: SDK

The SDK is a lightweight TypeScript package for code-driven agent systems.

```typescript
import { initObserver } from '@ai-agent-observer/sdk';

const observer = initObserver({
  redisUrl: process.env.REDIS_URL,
});

// One trace per complete run
const trace = observer.startTrace('Debug: filter bug', {
  tags: ['debug', 'cross-repo'],
});

// Each agent invocation is a span
const span = trace.startSpan('Scout', {
  agent: 'scout',
  modelTier: 'sonnet',
  role: 'analysis',
  input: { bugDescription: '...' },
});

// Spans nest — child spans get parentSpanId automatically
const search = span.startSpan('search_backend_routes', {
  input: { query: 'browse-stations' },
});
search.end({ status: 'SUCCESS', output: { matchCount: 3 } });

// End with token counts and cost
span.end({
  status: 'SUCCESS',
  tokensIn: 4200,
  tokensOut: 380,
  cost: 0.015,
});

// Record events for checkpoints and escalations
span.addEvent('checkpoint', 'User approved diagnosis');
span.addEvent('escalation', 'Worker failed, escalating to Fixer', {
  fromTier: 'haiku',
  toTier: 'sonnet',
});

// End trace
trace.end();
await observer.shutdown();
```

### Tool call tracing

The SDK provides `traceTool` to automatically trace any tool or function call — MCP tools, API requests, database queries, or any async operation. It creates a child span, records the input, executes the function, captures the output on success or the error on failure, and sets the status accordingly.

```typescript
// Trace MCP tool calls — input/output/errors captured automatically
const routes = await phase1a.traceTool(
  'search_backend_routes',
  { query: 'browse-stations', method: 'GET' },
  () => mcp.searchBackendRoutes({ query: 'browse-stations' }),
);

// If the tool throws, the span is marked FAILURE with the error message,
// and the error re-throws so your orchestrator can handle it
const endpoint = await phase1a.traceTool(
  'get_backend_endpoint',
  { name: 'browse-stations' },
  () => mcp.getBackendEndpoint({ name: 'browse-stations' }),
);
```

### SDK API surface

| Method | Description |
|--------|-------------|
| `initObserver({ redisUrl })` | Create an observer instance connected to Redis |
| `observer.startTrace(name, { tags, metadata })` | Start a new trace, returns a `TraceHandle` |
| `trace.startSpan(name, { agent, modelTier, role, phase, input })` | Start a root span within the trace |
| `span.startSpan(name, options)` | Start a child span (parentSpanId set automatically) |
| `span.traceTool(name, input, fn)` | Trace a tool/function call — auto-captures output, errors, and duration |
| `span.addEvent(type, message, metadata)` | Record a checkpoint, escalation, or other event |
| `span.end({ status, tokensIn, tokensOut, cost, output, error })` | End the span with results |
| `trace.end(status)` | End the trace, computes total cost |

### Fire-and-forget design

The SDK never blocks the agent:

```
Agent code                     SDK                        Redis Stream
─────────                      ───                        ────────────
span.end({...})  ──>  push to in-memory queue
       <── returns immediately     │
                                   │  every 1.5s
                                   ├──────────────>  XADD (pipeline)
                                   │
               if flush fails:     │
               drop the batch,  <──┘
               keep running
                                                     Ingestion Worker
                                                     ────────────────
                                                     XREADGROUP (batch 100)
                                                            │
                                                            ▼
                                                     PostgreSQL ($transaction)
                                                            │
                                                     XACK (acknowledge)
```

- **All SDK methods are synchronous** — `startSpan`, `end`, `addEvent`, and `traceTool` push to an in-memory queue and return immediately. The agent never awaits a network write.
- **Background flush** — a timer drains the queue every 1.5 seconds (configurable via `flushIntervalMs`), publishing all buffered events to Redis in a single pipeline.
- **Bounded queue** — the queue holds up to 1,000 events (configurable via `maxQueueSize`). If the queue fills up (because Redis is slow or down), the oldest events are dropped.
- **Silent failure** — if a flush fails (Redis is down, network error, etc.), the batch is discarded and the SDK continues buffering new events. No errors propagate to the agent.
- **At-least-once delivery** — the ingestion worker uses Redis consumer groups. Messages are only acknowledged after successful Postgres writes. If the worker crashes, unacknowledged messages are redelivered.
- **Graceful shutdown** — `observer.shutdown()` flushes any remaining events before disconnecting.

```typescript
const observer = initObserver({
  redisUrl: process.env.REDIS_URL,
  flushIntervalMs: 2000,
  maxQueueSize: 5000,
});
```

If `REDIS_URL` is not set or Redis is unreachable, `initObserver` returns a no-op observer. Every method works but does nothing. The agent code doesn't need a single `if` statement or try/catch — it runs identically whether the observer is active or not.

## Integration: MCP server

The MCP server exposes tracing as tools for prompt-driven agent systems. Any MCP-compatible client (Claude Code, custom agents) can call these tools without importing any code.

### Setup

Add the observer to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "observer": {
      "command": "npx",
      "args": ["tsx", "/path/to/ai-agent-observer/packages/mcp/src/index.ts"],
      "env": {
        "REDIS_URL": "redis://localhost:6380"
      }
    }
  }
}
```

The server starts as a subprocess, connects to Redis once, and stays running for the session. All tool calls are fire-and-forget — if Redis is down, tools return silently and the agent continues.

### Tools

| Tool | Input | Returns | Description |
|------|-------|---------|-------------|
| `trace_start` | `name`, `tags?`, `metadata?` | `traceId` | Start a new trace |
| `trace_end` | `traceId`, `status?` | confirmation | End a trace (COMPLETED/FAILED) |
| `span_start` | `name`, `traceId`, `parentSpanId?`, `agent?`, `modelTier?`, `role?`, `phase?`, `input?` | `spanId` | Start a span |
| `span_end` | `spanId`, `status?`, `tokensIn?`, `tokensOut?`, `cost?`, `output?`, `error?` | confirmation | End a span |
| `span_event` | `spanId`, `type`, `message`, `metadata?` | confirmation | Record a checkpoint, escalation, or event |

### Example flow

A Claude Code slash command orchestrating agents would use the tools like this:

```
1. Call trace_start("Debug: filter returns empty results", tags: "debug,cross-repo")
   → returns traceId

2. Call span_start("Phase 1A: Backend mapping", traceId: traceId, phase: "1A", role: "analysis")
   → returns spanId

3. Call your MCP tools (search_backend_routes, etc.)

4. Call span_end(spanId, status: "SUCCESS")

5. Call span_start("Scout", traceId: traceId, agent: "scout", modelTier: "sonnet", role: "analysis")
   → returns scoutSpanId

6. Spawn Scout sub-agent, wait for result

7. Call span_end(scoutSpanId, status: "SUCCESS")

8. Call span_event(scoutSpanId, type: "checkpoint", message: "User approved diagnosis")

... continue through phases ...

9. Call trace_end(traceId, status: "COMPLETED")
```

Each tool call pushes an event to Redis and returns immediately. The dashboard shows the full trace with all spans nested by parent-child depth.

## Getting started

### Prerequisites

- Node.js 22+
- Docker

### 1. Clone and install

```bash
git clone <repo-url>
cd ai-agent-observer
cp .env.example .env
npm install
```

### 2. Start services

```bash
docker compose up -d --build
```

This builds and starts three containers:
- **PostgreSQL** on port 5433 — stores traces, spans, and events
- **Redis** on port 6380 — buffers events from the SDK and MCP server
- **Ingestion worker** — reads from Redis and writes to Postgres (starts automatically after both are healthy, restarts on failure)

### 3. Set up the database

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

The seed script loads 3 example traces with realistic spans modeled after a multi-agent debugging orchestrator — including a successful run with an escalation chain, a failed run, and a run in progress.

### 4. Start the dashboard

```bash
npm run dev
```

Open [http://localhost:3080](http://localhost:3080).

### 5. Test the pipeline

Send a test trace through the full pipeline (SDK → Redis → Ingestion → Postgres → Dashboard):

```bash
npm run test:trace
```

This script simulates a multi-agent debug session: Scout analyzes, Cartographer diagnoses, Worker fails, Fixer retries — with MCP tool calls and escalation events. Open the dashboard to see the new trace appear with the full span waterfall.

## Production deployment

The same docker-compose runs in production, pointed at managed Postgres and Redis:

```bash
docker compose up -d
```

Or build and deploy the containers individually:

```bash
# Dashboard
docker build -f docker/Dockerfile -t ai-agent-observer .

# Ingestion worker
docker build -f docker/Dockerfile.ingestion -t ai-agent-observer-ingestion .
```

Both containers take `DATABASE_URL` and `REDIS_URL` as environment variables. The ingestion worker is stateless and configured with `restart: unless-stopped` — it reconnects automatically if Redis or Postgres restarts.
