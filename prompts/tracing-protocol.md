# Tracing protocol for prompt-driven agents

Generic tracing instructions for any prompt-driven orchestrator using the AI Agent
Observer MCP server. Include this protocol in your orchestrator prompt to get automatic
trace collection.

## Prerequisites

The observer MCP server must be registered in `.mcp.json`. This gives you five tools:
`trace_start`, `span_start`, `span_end`, `span_event`, `trace_end`.

## Rules

1. **Check availability first.** If `trace_start` is not available as a tool, skip all
   tracing — the observer is not configured. Never fail because of missing tracing tools.
2. **Never block on tracing.** If a tracing call fails or returns an error, ignore it
   and continue with your actual work. Tracing is best-effort.
3. **One trace per session.** Call `trace_start` once at the beginning. Store the
   returned `traceId`. Use it in every subsequent call.
4. **One span per unit of work.** Before spawning an agent or starting a distinct phase,
   call `span_start`. When it completes, call `span_end`.
5. **Nest spans with `parentSpanId`.** If a phase contains multiple agent calls, start
   a parent span for the phase, then start child spans for each agent with
   `parentSpanId` set to the phase span.
6. **Record checkpoints.** When you pause for user input (approvals, confirmations,
   corrections), call `span_event` with type `"checkpoint"` after the user replies.
   Include the user's decision in the message.
7. **Record escalations.** When a cheap agent fails and you retry with a more capable
   one, call `span_event` with type `"escalation"` on the failed span. Include
   `fromTier` and `toTier` in the metadata.
8. **End the trace.** Call `trace_end` at the end of the session with status
   `"COMPLETED"` or `"FAILED"`.

## Span fields

When calling `span_start`, provide as many fields as apply:

| Field | When to use | Examples |
|-------|-------------|----------|
| `name` | Always (required) | `"Scout"`, `"Phase 1: Analysis"`, `"Worker S3"` |
| `traceId` | Always (required) | The ID from `trace_start` |
| `parentSpanId` | Nested spans | The parent phase or agent span ID |
| `agent` | Agent invocations | `"scout"`, `"worker"`, `"cartographer"` |
| `modelTier` | Agent invocations | `"haiku"`, `"sonnet"`, `"opus"` |
| `role` | Categorize the work | `"analysis"`, `"diagnosis"`, `"planning"`, `"execution"`, `"verification"` |
| `phase` | Phased workflows | `"1A"`, `"3"`, `"7"` |

When calling `span_end`, provide:

| Field | When to use | Examples |
|-------|-------------|----------|
| `status` | Always | `"SUCCESS"`, `"FAILURE"`, `"SKIPPED"` |
| `error` | On failure | The error message or reason |

## Example: multi-agent orchestrator

```
Session starts
  → trace_start("Debug: login button broken", tags: "debug")
  → store traceId

Phase 1: Analysis
  → span_start("Phase 1: Analysis", traceId, phase: "1", role: "analysis")
  → store phaseSpanId

  Spawn Scout agent
    → span_start("Scout", traceId, parentSpanId: phaseSpanId, agent: "scout", modelTier: "sonnet")
    → store scoutSpanId
    → [agent runs]
    → span_end(scoutSpanId, status: "SUCCESS")

  → span_end(phaseSpanId, status: "SUCCESS")

User checkpoint
  → [ask user for confirmation]
  → span_event(phaseSpanId, type: "checkpoint", message: "User confirmed analysis")

Phase 2: Execution
  → span_start("Phase 2: Execution", traceId, phase: "2", role: "execution")
  → store execSpanId

  Spawn Worker (attempt 1)
    → span_start("Worker", traceId, parentSpanId: execSpanId, agent: "worker", modelTier: "haiku")
    → store workerSpanId
    → [agent fails]
    → span_end(workerSpanId, status: "FAILURE", error: "Edit anchor not found")
    → span_event(workerSpanId, type: "escalation", message: "Worker failed, escalating to Fixer",
        metadata: {"fromTier": "haiku", "toTier": "sonnet"})

  Spawn Fixer (retry)
    → span_start("Fixer", traceId, parentSpanId: execSpanId, agent: "fixer", modelTier: "sonnet")
    → store fixerSpanId
    → [agent succeeds]
    → span_end(fixerSpanId, status: "SUCCESS")

  → span_end(execSpanId, status: "SUCCESS")

Session ends
  → trace_end(traceId, status: "COMPLETED")
```

## Integration checklist

- [ ] Add observer MCP server to `.mcp.json`
- [ ] Start observer infrastructure (`docker compose up -d && npm run db:migrate`)
- [ ] Add to your orchestrator prompt: "If `trace_start` is available, follow the tracing protocol at `<path>/prompts/tracing-protocol.md`"
- [ ] Restart Claude Code to pick up the MCP tools
- [ ] Run your orchestrator — traces appear in the dashboard at `localhost:3080`
