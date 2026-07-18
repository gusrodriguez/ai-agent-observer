import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spans } from "../state.js";

export function registerSpanEvent(server: McpServer) {
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
}
