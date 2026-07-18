import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTraceStart } from "./tools/trace-start.js";
import { registerTraceEnd } from "./tools/trace-end.js";
import { registerSpanStart } from "./tools/span-start.js";
import { registerSpanEnd } from "./tools/span-end.js";
import { registerSpanEvent } from "./tools/span-event.js";

const server = new McpServer({
  name: "ai-agent-observer",
  version: "0.1.0",
});

registerTraceStart(server);
registerTraceEnd(server);
registerSpanStart(server);
registerSpanEnd(server);
registerSpanEvent(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AI Agent Observer MCP server running on stdio");
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
