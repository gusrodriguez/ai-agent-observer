import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { traces } from "../state.js";

export function registerTraceEnd(server: McpServer) {
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
}
