/**
 * Sends a realistic trace through the SDK → Redis pipeline.
 * Run the ingestion worker (`npm run ingest`) first, then run this script.
 *
 * Usage:
 *   npm run test:trace
 */

import { initObserver } from "../packages/sdk/src/index.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const observer = initObserver({
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
  });

  // Simulate a debug session with Scout → Cartographer → Worker (fails) → Fixer
  const trace = observer.startTrace("Debug: dropdown resets on navigation", {
    tags: ["debug", "cross-repo"],
  });

  // Phase 1A: Backend mapping via MCP tools
  const phase1a = trace.startSpan("Phase 1A: Backend mapping", {
    phase: "1A",
    role: "analysis",
  });

  await phase1a.traceTool(
    "search_backend_routes",
    { query: "browse-dropdowns", method: "GET" },
    async () => {
      await sleep(800);
      return { matchCount: 2, routes: ["browse-dropdowns", "get-dropdown"] };
    },
  );

  await phase1a.traceTool(
    "get_backend_endpoint",
    { name: "browse-dropdowns" },
    async () => {
      await sleep(600);
      return { handler: "browse-dropdowns.ts", prismaModels: ["Dropdown", "DropdownOption"] };
    },
  );

  phase1a.end({ status: "SUCCESS" });

  // Phase 1B: Scout analyzes frontend
  const scout = trace.startSpan("Scout", {
    agent: "scout",
    modelTier: "sonnet",
    role: "analysis",
    phase: "1B",
    input: { bugDescription: "Dropdown selection resets when navigating between tabs" },
  });

  await sleep(1200);

  scout.end({
    status: "SUCCESS",
    tokensIn: 3800,
    tokensOut: 420,
    cost: 0.014,
    output: {
      brief: "DropdownFilter component re-mounts on tab change because key prop includes route path. State is lost on every navigation.",
    },
  });

  // Phase 3: Cartographer diagnoses
  const cartographer = trace.startSpan("Cartographer", {
    agent: "cartographer",
    modelTier: "sonnet",
    role: "diagnosis",
    phase: "3",
  });

  await sleep(1000);

  cartographer.addEvent("checkpoint", "User approved diagnosis", {
    phase: "4",
    userResponse: "yes, proceed",
  });

  cartographer.end({
    status: "SUCCESS",
    tokensIn: 5100,
    tokensOut: 310,
    cost: 0.018,
    output: {
      side: "frontend",
      suspect: "DropdownFilter.tsx:28",
      hypothesis: "Component key includes pathname, causing re-mount on tab change",
      confidence: "high",
    },
  });

  // Phase 7: Worker fails, Fixer succeeds
  const worker = trace.startSpan("Worker:S1", {
    agent: "worker",
    modelTier: "haiku",
    role: "execution",
    phase: "7",
  });

  await sleep(500);

  worker.end({
    status: "FAILURE",
    tokensIn: 1400,
    tokensOut: 90,
    cost: 0.001,
    error: "Anchor not found: expected 'key={`filter-${pathname}`}' but found 'key={`filter-${pathname}-${search}`}'",
  });

  worker.addEvent("escalation", "Worker failed, escalating to Fixer", {
    fromAgent: "worker",
    fromTier: "haiku",
    toAgent: "fixer",
    toTier: "sonnet",
  });

  const fixer = trace.startSpan("Fixer:S1", {
    agent: "fixer",
    modelTier: "sonnet",
    role: "execution",
    phase: "7",
  });

  await sleep(800);

  fixer.end({
    status: "SUCCESS",
    tokensIn: 5800,
    tokensOut: 380,
    cost: 0.011,
  });

  // End trace
  trace.end("COMPLETED");

  // Flush and disconnect
  await observer.shutdown();

  console.log("Trace sent to Redis. Check the dashboard at http://localhost:3080");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
