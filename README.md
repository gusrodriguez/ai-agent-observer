# AI Agent Observe

Observability toolkit for AI agent systems. Traces multi-agent workflows end-to-end, tracking which agents ran, what model tier they used, how many tokens they consumed, what they cost, and where they failed — with a web dashboard to inspect it all.

Built to solve a real problem: multi-agent orchestrators (LangChain, CrewAI, custom pipelines) are opaque at runtime. When an agent chain fails or costs spike, there's no structured way to see what happened inside. AI Agent Observe brings the same trace-and-span model used in distributed systems observability to AI agent workflows.

![Trace detail view showing a multi-agent debug session with span waterfall, model tier badges, and cost tracking](docs/observe.png)

## How it works

The system has two parts: a **tracing SDK** that agent applications import, and a **dashboard** that reads the collected data.

```
Your agent system                       AI Agent Observe
┌─────────────────────┐
│  Orchestrator       │                ┌─────────────────┐
│  ├── Scout (sonnet) │   SDK writes   │                 │
│  ├── Planner (opus) │ ─────────────> │   PostgreSQL    │
│  ├── Worker (haiku) │   traces,      │                 │
│  │   └── retry?     │   spans,       └────────┬────────┘
│  │       Fixer      │   events                │
│  └── Verifier       │                         │ reads
└─────────────────────┘                ┌────────▼────────┐
                                       │   Dashboard     │
                                       │   :3080         │
                                       └─────────────────┘
```

The SDK writes trace data directly to PostgreSQL. The agent system doesn't know about the dashboard, and the dashboard doesn't know about the agent system — they only share the database.

Any agent framework can integrate: import the SDK, wrap agent calls with `startSpan` / `end`, and the dashboard shows the traces.

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
  databaseUrl: process.env.DATABASE_URL,
});

// One trace per complete run
const trace = await observer.startTrace('Debug: filter bug', {
  tags: ['debug', 'cross-repo'],
});

// Each agent invocation is a span
const span = await trace.startSpan('Scout', {
  agent: 'scout',
  modelTier: 'sonnet',
  role: 'analysis',
  input: { bugDescription: '...' },
});

// Spans nest — child spans get parentSpanId automatically
const search = await span.startSpan('search_backend_routes', {
  input: { query: 'browse-stations' },
});
await search.end({ status: 'SUCCESS', output: { matchCount: 3 } });

// End with token counts and cost
await span.end({
  status: 'SUCCESS',
  tokensIn: 4200,
  tokensOut: 380,
  cost: 0.015,
});

// Record events for checkpoints and escalations
await span.addEvent('checkpoint', 'User approved diagnosis');
await span.addEvent('escalation', 'Worker failed, escalating to Fixer', {
  fromTier: 'haiku',
  toTier: 'sonnet',
});

// End trace — aggregates total cost from all spans
await trace.end();
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
| `initObserver({ databaseUrl })` | Create an observer instance connected to Postgres |
| `observer.startTrace(name, { tags, metadata })` | Start a new trace, returns a `TraceHandle` |
| `trace.startSpan(name, { agent, modelTier, role, phase, input })` | Start a root span within the trace |
| `span.startSpan(name, options)` | Start a child span (parentSpanId set automatically) |
| `span.traceTool(name, input, fn)` | Trace a tool/function call — auto-captures output, errors, and duration |
| `span.addEvent(type, message, metadata)` | Record a checkpoint, escalation, or other event |
| `span.end({ status, tokensIn, tokensOut, cost, output, error })` | End the span with results |
| `trace.end(status)` | End the trace, computes total cost |

## Getting started

### Prerequisites

- Node.js 22+
- Docker

### 1. Start Postgres

```bash
docker run -d \
  --name agent-observer-db \
  -e POSTGRES_USER=observe \
  -e POSTGRES_PASSWORD=observe \
  -e POSTGRES_DB=agent_observe \
  -p 5433:5432 \
  postgres:16-alpine
```

### 2. Install and set up

```bash
git clone <repo-url>
cd ai-agent-observer
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

The seed script loads 3 example traces with realistic spans modeled after a multi-agent debugging orchestrator — including a successful run with an escalation chain, a failed run, and a run in progress.

### 3. Start the dashboard

```bash
npm run dev
```

Open [http://localhost:3080](http://localhost:3080).

## Production deployment

Build and run the Docker image, pointing it at a managed Postgres instance:

```bash
docker build -f docker/Dockerfile -t ai-agent-observer .

docker run -d \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -p 3080:3080 \
  ai-agent-observer
```