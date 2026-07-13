import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { initObserver } from "@ai-agent-observer/sdk";
import type { TraceHandle, SpanHandle } from "@ai-agent-observer/sdk";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const observer = initObserver({ redisUrl });

// Track active traces and spans by ID so tools can reference them
const traces = new Map<string, TraceHandle>();
const spans = new Map<string, SpanHandle>();

const server = new McpServer({
  name: "ai-agent-observer",
  version: "0.1.0",
});

// --- trace_start ---

server.registerTool(
  "trace_start",
  {
    description:
      "Start a new trace. A trace represents one complete agent run (a debug session, a code review, a generation pipeline). Returns a traceId to use with other tools.",
    inputSchema: {
      name: z.string().describe("Name of the trace (e.g. 'Debug: filter bug')"),
      tags: z
        .string()
        .optional()
        .describe("Comma-separated tags (e.g. 'debug,cross-repo')"),
      metadata: z
        .string()
        .optional()
        .describe("JSON string of arbitrary metadata"),
    },
  },
  ({ name, tags, metadata }) => {
    const parsedTags = tags ? tags.split(",").map((t) => t.trim()) : undefined;
    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch {
        // ignore malformed metadata
      }
    }

    const trace = observer.startTrace(name, {
      tags: parsedTags,
      metadata: parsedMetadata,
    });
    traces.set(trace.id, trace);

    return {
      content: [{ type: "text" as const, text: trace.id }],
    };
  },
);

// --- trace_end ---

server.registerTool(
  "trace_end",
  {
    description: "End a trace. Call this when the agent run is complete.",
    inputSchema: {
      traceId: z.string().describe("The trace ID returned by trace_start"),
      status: z
        .enum(["COMPLETED", "FAILED"])
        .optional()
        .describe("Final status (default: COMPLETED)"),
    },
  },
  ({ traceId, status }) => {
    const trace = traces.get(traceId);
    if (!trace) {
      return {
        content: [{ type: "text" as const, text: `Trace ${traceId} not found` }],
        isError: true,
      };
    }

    trace.end(status ?? "COMPLETED");
    traces.delete(traceId);

    return {
      content: [{ type: "text" as const, text: `Trace ${traceId} ended` }],
    };
  },
);

// --- span_start ---

server.registerTool(
  "span_start",
  {
    description:
      "Start a span within a trace. A span represents one unit of work: an agent invocation, a tool call, an LLM request. Returns a spanId. Nest spans by passing parentSpanId.",
    inputSchema: {
      name: z.string().describe("Span name (e.g. 'Scout', 'search_backend_routes')"),
      traceId: z.string().describe("The trace ID this span belongs to"),
      parentSpanId: z
        .string()
        .optional()
        .describe("Parent span ID for nesting (omit for root spans)"),
      agent: z
        .string()
        .optional()
        .describe("Agent name (e.g. 'scout', 'cartographer', 'worker')"),
      modelTier: z
        .string()
        .optional()
        .describe("Model tier (e.g. 'haiku', 'sonnet', 'opus')"),
      role: z
        .string()
        .optional()
        .describe("Role (e.g. 'analysis', 'diagnosis', 'execution', 'tool')"),
      phase: z.string().optional().describe("Phase identifier (e.g. '1A', '3', '7')"),
      input: z
        .string()
        .optional()
        .describe("JSON string of the input data passed to this agent/tool"),
    },
  },
  ({ name, traceId, parentSpanId, agent, modelTier, role, phase, input }) => {
    let parsedInput: unknown;
    if (input) {
      try {
        parsedInput = JSON.parse(input);
      } catch {
        parsedInput = input;
      }
    }

    let span: SpanHandle;

    if (parentSpanId) {
      // Nested span — start from parent
      const parent = spans.get(parentSpanId);
      if (parent) {
        span = parent.startSpan(name, { agent, modelTier, role, phase, input: parsedInput });
      } else {
        // Parent not found — start from trace as root span with parentSpanId set
        const trace = traces.get(traceId);
        if (!trace) {
          return {
            content: [{ type: "text" as const, text: `Trace ${traceId} not found` }],
            isError: true,
          };
        }
        span = trace.startSpan(name, {
          parentSpanId,
          agent,
          modelTier,
          role,
          phase,
          input: parsedInput,
        });
      }
    } else {
      // Root span — start from trace
      const trace = traces.get(traceId);
      if (!trace) {
        return {
          content: [{ type: "text" as const, text: `Trace ${traceId} not found` }],
          isError: true,
        };
      }
      span = trace.startSpan(name, { agent, modelTier, role, phase, input: parsedInput });
    }

    spans.set(span.id, span);

    return {
      content: [{ type: "text" as const, text: span.id }],
    };
  },
);

// --- span_end ---

server.registerTool(
  "span_end",
  {
    description: "End a span. Call this when the agent or tool call completes.",
    inputSchema: {
      spanId: z.string().describe("The span ID returned by span_start"),
      status: z
        .enum(["SUCCESS", "FAILURE", "SKIPPED"])
        .optional()
        .describe("Outcome (default: SUCCESS)"),
      tokensIn: z.number().optional().describe("Input token count"),
      tokensOut: z.number().optional().describe("Output token count"),
      cost: z.number().optional().describe("Dollar cost of this span"),
      output: z.string().optional().describe("JSON string of the output/result"),
      error: z.string().optional().describe("Error message if status is FAILURE"),
    },
  },
  ({ spanId, status, tokensIn, tokensOut, cost, output, error }) => {
    const span = spans.get(spanId);
    if (!span) {
      return {
        content: [{ type: "text" as const, text: `Span ${spanId} not found` }],
        isError: true,
      };
    }

    let parsedOutput: unknown;
    if (output) {
      try {
        parsedOutput = JSON.parse(output);
      } catch {
        parsedOutput = output;
      }
    }

    span.end({ status, tokensIn, tokensOut, cost, output: parsedOutput, error });
    spans.delete(spanId);

    return {
      content: [{ type: "text" as const, text: `Span ${spanId} ended` }],
    };
  },
);

// --- span_event ---

server.registerTool(
  "span_event",
  {
    description:
      "Record an event on a span. Use for checkpoints (user approvals), escalations (agent failures), or any discrete happening.",
    inputSchema: {
      spanId: z.string().describe("The span ID to attach the event to"),
      type: z
        .string()
        .describe("Event type (e.g. 'checkpoint', 'escalation', 'error', 'log')"),
      message: z.string().describe("Human-readable event description"),
      metadata: z.string().optional().describe("JSON string of event metadata"),
    },
  },
  ({ spanId, type, message, metadata }) => {
    const span = spans.get(spanId);
    if (!span) {
      return {
        content: [{ type: "text" as const, text: `Span ${spanId} not found` }],
        isError: true,
      };
    }

    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch {
        // ignore malformed metadata
      }
    }

    span.addEvent(type, message, parsedMetadata);

    return {
      content: [{ type: "text" as const, text: "Event recorded" }],
    };
  },
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AI Agent Observer MCP server running on stdio");
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
