import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spans } from "../state.js";

export function registerSpanEnd(server: McpServer) {
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
}
