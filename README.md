# AI Agent Observer

Observability toolkit for AI agent systems. Traces multi-agent workflows end-to-end, tracking which agents ran, what model tier they used, how many tokens they consumed, what they cost, and where they failed — with a web dashboard to inspect it all.

Built to solve a real problem: multi-agent orchestrators (LangChain, CrewAI, custom pipelines) are opaque at runtime. When an agent chain fails or costs spike, there's no structured way to see what happened inside. AI Agent Observer brings the same trace-and-span model used in distributed systems observability to AI agent workflows.

![Trace detail view showing a multi-agent debug session with span waterfall, model tier badges, and cost tracking](docs/observe.png)

## How it works

The system has three parts: a **tracing SDK** that agent applications import, a **Redis Stream** that buffers events, and an **ingestion worker** that writes them to PostgreSQL for the dashboard.

```
Your agent system                       AI Agent Observer
┌─────────────────────┐
│  Orchestrator       │                ┌─────────────────┐
│  ├── Scout (sonnet) │   SDK writes   │                 │
│  ├── Planner (opus) │ ─────────────> │   Redis Stream   │
│  ├── Worker (haiku) │   XADD         │                 │
│  │   └── retry?     │                └────────┬────────┘
│  │       Fixer      │                         │ XREADGROUP
│  └── Verifier       │                ┌────────▼────────┐
└─────────────────────┘                │ Ingestion Worker │
                                       └────────┬────────┘
                                                │ Prisma
                                       ┌────────▼────────┐
                                       │   PostgreSQL     │
                                       └────────┬────────┘
                                                │ reads
                                       ┌────────▼────────┐
                                       │   Dashboard      │
                                       │   :3080          │
                                       └─────────────────┘
```

The SDK pushes events to a Redis Stream via `XADD`. An ingestion worker reads from the stream using consumer groups (`XREADGROUP`), writes batches to PostgreSQL, and acknowledges processed messages. The dashboard reads from Postgres.

The agent system doesn't know about the dashboard, and the dashboard doesn't know about the agent system — they only share the data pipeline.

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

## SDK

The SDK is a lightweight TypeScript package that agent applications import.

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

// Works for any async call — external APIs, database queries, etc.
const analysis = await span.traceTool(
  'openai-embedding',
  { text: codeSnippet },
  () => openai.embeddings.create({ input: codeSnippet, model: 'text-embedding-3-small' }),
);
```

In the dashboard, tool spans appear as children of the agent that called them, with their input/output visible in the detail panel. Failed tool calls show the error message and are highlighted in red in the waterfall.

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
- **Redis** on port 6380 — buffers events from the SDK
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
