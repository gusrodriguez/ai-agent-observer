import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpanHandle } from "../../sdk/index.js";
import { traces, spans } from "../state.js";

export function registerSpanStart(server: McpServer) {
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
        const parent = spans.get(parentSpanId);
        if (parent) {
          span = parent.startSpan(name, { agent, modelTier, role, phase, input: parsedInput });
        } else {
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
}
