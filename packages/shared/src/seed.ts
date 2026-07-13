import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.event.deleteMany();
  await prisma.span.deleteMany();
  await prisma.trace.deleteMany();

  const now = Date.now();

  // --- Trace 1: Completed debug session with escalation ---
  const trace1 = await prisma.trace.create({
    data: {
      name: "Debug: browse-stations filter returns empty results",
      status: "COMPLETED",
      tags: ["debug", "cross-repo"],
      metadata: { app: "ground-audits", bugId: "GA-142" },
      startedAt: new Date(now - 180_000),
      endedAt: new Date(now - 10_000),
      durationMs: 170_000,
      totalCost: 0.0847,
    },
  });

  // Phase 1A: Backend mapping
  const phase1a = await prisma.span.create({
    data: {
      traceId: trace1.id,
      name: "Phase 1A: Backend mapping",
      phase: "1A",
      role: "analysis",
      status: "SUCCESS",
      startedAt: new Date(now - 175_000),
      endedAt: new Date(now - 165_000),
      durationMs: 10_000,
    },
  });

  await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase1a.id,
      name: "search_backend_routes",
      agent: "orchestrator",
      role: "tool",
      status: "SUCCESS",
      input: { query: "browse-stations", method: "GET" },
      output: { matchCount: 2, routes: ["browse-stations", "get-station"] },
      startedAt: new Date(now - 175_000),
      endedAt: new Date(now - 172_000),
      durationMs: 3_000,
    },
  });

  await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase1a.id,
      name: "get_backend_endpoint",
      agent: "orchestrator",
      role: "tool",
      status: "SUCCESS",
      input: { name: "browse-stations" },
      output: { handler: "browse-stations.ts", prismaModels: ["Station"] },
      startedAt: new Date(now - 172_000),
      endedAt: new Date(now - 165_000),
      durationMs: 7_000,
    },
  });

  // Phase 1B: Scout
  const phase1b = await prisma.span.create({
    data: {
      traceId: trace1.id,
      name: "Phase 1B: Frontend analysis",
      phase: "1B",
      role: "analysis",
      status: "SUCCESS",
      startedAt: new Date(now - 165_000),
      endedAt: new Date(now - 140_000),
      durationMs: 25_000,
    },
  });

  await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase1b.id,
      name: "Scout",
      agent: "scout",
      modelTier: "sonnet",
      role: "analysis",
      status: "SUCCESS",
      tokensIn: 4200,
      tokensOut: 380,
      cost: 0.015,
      input: {
        bugDescription: "Station filter returns empty when selecting region",
        appPath: "/Users/dev/frontend/apps/ground-audits-admin",
      },
      output: {
        brief:
          "StationFilter component sends region param as array but API expects string. Service call at station.service.ts:42.",
      },
      startedAt: new Date(now - 165_000),
      endedAt: new Date(now - 140_000),
      durationMs: 25_000,
    },
  });

  // Phase 3: Cartographer
  const phase3 = await prisma.span.create({
    data: {
      traceId: trace1.id,
      name: "Phase 3: Diagnosis",
      phase: "3",
      role: "diagnosis",
      status: "SUCCESS",
      startedAt: new Date(now - 135_000),
      endedAt: new Date(now - 115_000),
      durationMs: 20_000,
    },
  });

  const cartographer = await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase3.id,
      name: "Cartographer",
      agent: "cartographer",
      modelTier: "sonnet",
      role: "diagnosis",
      status: "SUCCESS",
      tokensIn: 5800,
      tokensOut: 290,
      cost: 0.019,
      output: {
        side: "frontend",
        suspect: "station.service.ts:42",
        hypothesis:
          "Region param serialized as array instead of comma-separated string",
        confidence: "high",
      },
      startedAt: new Date(now - 135_000),
      endedAt: new Date(now - 115_000),
      durationMs: 20_000,
    },
  });

  await prisma.event.create({
    data: {
      spanId: cartographer.id,
      type: "checkpoint",
      message: "User approved diagnosis",
      metadata: { phase: "4", userResponse: "yes, proceed" },
      timestamp: new Date(now - 112_000),
    },
  });

  // Phase 5: Architect
  const phase5 = await prisma.span.create({
    data: {
      traceId: trace1.id,
      name: "Phase 5: Fix planning",
      phase: "5",
      role: "planning",
      status: "SUCCESS",
      startedAt: new Date(now - 110_000),
      endedAt: new Date(now - 75_000),
      durationMs: 35_000,
    },
  });

  await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase5.id,
      name: "Architect",
      agent: "architect",
      modelTier: "opus",
      role: "planning",
      status: "SUCCESS",
      tokensIn: 8200,
      tokensOut: 1200,
      cost: 0.032,
      output: {
        waves: 2,
        steps: [
          "S1: Fix param serialization in station.service.ts",
          "S2: Update StationFilter component types",
          "S3: Add query param validation in browse-stations handler",
        ],
      },
      startedAt: new Date(now - 110_000),
      endedAt: new Date(now - 75_000),
      durationMs: 35_000,
    },
  });

  // Phase 7: Execution with escalation
  const phase7 = await prisma.span.create({
    data: {
      traceId: trace1.id,
      name: "Phase 7: Execution",
      phase: "7",
      role: "execution",
      status: "SUCCESS",
      startedAt: new Date(now - 70_000),
      endedAt: new Date(now - 20_000),
      durationMs: 50_000,
    },
  });

  // Worker S1 — succeeds
  await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase7.id,
      name: "Worker:S1",
      agent: "worker",
      modelTier: "haiku",
      role: "execution",
      status: "SUCCESS",
      tokensIn: 1800,
      tokensOut: 320,
      cost: 0.002,
      startedAt: new Date(now - 70_000),
      endedAt: new Date(now - 60_000),
      durationMs: 10_000,
    },
  });

  // Worker S2 — fails
  const workerS2 = await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase7.id,
      name: "Worker:S2",
      agent: "worker",
      modelTier: "haiku",
      role: "execution",
      status: "FAILURE",
      tokensIn: 1600,
      tokensOut: 180,
      cost: 0.0015,
      error: "Anchor not found: expected 'interface StationFilterProps' at line 15 but file has been modified",
      startedAt: new Date(now - 70_000),
      endedAt: new Date(now - 55_000),
      durationMs: 15_000,
    },
  });

  await prisma.event.create({
    data: {
      spanId: workerS2.id,
      type: "escalation",
      message: "Worker failed, user chose escalation to Fixer",
      metadata: {
        fromAgent: "worker",
        fromTier: "haiku",
        toAgent: "fixer",
        toTier: "sonnet",
        reason: "anchor missing",
      },
    },
  });

  // Fixer S2 retry — succeeds
  await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase7.id,
      name: "Fixer:S2",
      agent: "fixer",
      modelTier: "sonnet",
      role: "execution",
      status: "SUCCESS",
      tokensIn: 6100,
      tokensOut: 420,
      cost: 0.012,
      startedAt: new Date(now - 50_000),
      endedAt: new Date(now - 35_000),
      durationMs: 15_000,
    },
  });

  // Worker S3 — succeeds
  await prisma.span.create({
    data: {
      traceId: trace1.id,
      parentSpanId: phase7.id,
      name: "Worker:S3",
      agent: "worker",
      modelTier: "haiku",
      role: "execution",
      status: "SUCCESS",
      tokensIn: 1400,
      tokensOut: 280,
      cost: 0.0012,
      startedAt: new Date(now - 30_000),
      endedAt: new Date(now - 20_000),
      durationMs: 10_000,
    },
  });

  // Phase 8: Verification
  await prisma.span.create({
    data: {
      traceId: trace1.id,
      name: "Phase 8: Verification",
      phase: "8",
      role: "verification",
      status: "SUCCESS",
      startedAt: new Date(now - 18_000),
      endedAt: new Date(now - 10_000),
      durationMs: 8_000,
    },
  });

  // --- Trace 2: Failed session ---
  const trace2 = await prisma.trace.create({
    data: {
      name: "Debug: report export generates corrupt PDF",
      status: "FAILED",
      tags: ["debug"],
      metadata: { app: "turnaround" },
      startedAt: new Date(now - 400_000),
      endedAt: new Date(now - 320_000),
      durationMs: 80_000,
      totalCost: 0.038,
    },
  });

  const t2phase1a = await prisma.span.create({
    data: {
      traceId: trace2.id,
      name: "Phase 1A: Backend mapping",
      phase: "1A",
      role: "analysis",
      status: "SUCCESS",
      startedAt: new Date(now - 395_000),
      endedAt: new Date(now - 385_000),
      durationMs: 10_000,
    },
  });

  await prisma.span.create({
    data: {
      traceId: trace2.id,
      parentSpanId: t2phase1a.id,
      name: "search_backend_routes",
      agent: "orchestrator",
      status: "SUCCESS",
      input: { query: "export-report" },
      output: { matchCount: 1 },
      startedAt: new Date(now - 395_000),
      endedAt: new Date(now - 385_000),
      durationMs: 10_000,
    },
  });

  const t2scout = await prisma.span.create({
    data: {
      traceId: trace2.id,
      name: "Scout",
      agent: "scout",
      modelTier: "sonnet",
      role: "analysis",
      status: "SUCCESS",
      tokensIn: 3800,
      tokensOut: 340,
      cost: 0.013,
      startedAt: new Date(now - 380_000),
      endedAt: new Date(now - 360_000),
      durationMs: 20_000,
    },
  });

  await prisma.span.create({
    data: {
      traceId: trace2.id,
      name: "Cartographer",
      agent: "cartographer",
      modelTier: "sonnet",
      role: "diagnosis",
      status: "SUCCESS",
      tokensIn: 5200,
      tokensOut: 310,
      cost: 0.017,
      startedAt: new Date(now - 355_000),
      endedAt: new Date(now - 340_000),
      durationMs: 15_000,
    },
  });

  const t2worker = await prisma.span.create({
    data: {
      traceId: trace2.id,
      name: "Worker:S1",
      agent: "worker",
      modelTier: "haiku",
      role: "execution",
      status: "FAILURE",
      tokensIn: 1500,
      tokensOut: 100,
      cost: 0.001,
      error: "Cannot resolve import: @company/pdf-renderer module not found in workspace",
      startedAt: new Date(now - 330_000),
      endedAt: new Date(now - 325_000),
      durationMs: 5_000,
    },
  });

  const t2specialist = await prisma.span.create({
    data: {
      traceId: trace2.id,
      name: "Specialist:S1",
      agent: "specialist",
      modelTier: "opus",
      role: "execution",
      status: "FAILURE",
      tokensIn: 9200,
      tokensOut: 600,
      cost: 0.007,
      error: "Module requires workspace-level dependency resolution — cannot fix from this scope",
      startedAt: new Date(now - 322_000),
      endedAt: new Date(now - 320_000),
      durationMs: 2_000,
    },
  });

  await prisma.event.create({
    data: {
      spanId: t2specialist.id,
      type: "escalation",
      message: "Escalated from Worker to Specialist (skipped Fixer)",
      metadata: { fromAgent: "worker", toAgent: "specialist" },
    },
  });

  // --- Trace 3: Running (in progress) ---
  await prisma.trace.create({
    data: {
      name: "Debug: audit checklist items not saving",
      status: "RUNNING",
      tags: ["debug", "cross-repo"],
      metadata: { app: "ground-audits" },
      startedAt: new Date(now - 30_000),
      totalCost: null,
    },
  });

  console.log("Seeded 3 traces with spans and events.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
