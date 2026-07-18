import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { observer, traces } from "../state.js";

export function registerTraceStart(server: McpServer) {
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
}
