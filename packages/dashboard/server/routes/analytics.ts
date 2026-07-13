import { Router } from "express";
import { prisma } from "../prisma.js";

export const analyticsRouter = Router();

analyticsRouter.get("/api/analytics", async (_req, res) => {
  const [traceStats, successCount, costByModel, agentStats] =
    await Promise.all([
      prisma.trace.aggregate({
        _count: true,
        _avg: { durationMs: true, totalCost: true },
        _sum: { totalCost: true },
      }),
      prisma.trace.count({ where: { status: "COMPLETED" } }),
      prisma.span.groupBy({
        by: ["modelTier"],
        _sum: { cost: true },
        _count: true,
        _avg: { durationMs: true },
        where: { modelTier: { not: null } },
      }),
      prisma.span.groupBy({
        by: ["agent"],
        _count: true,
        _avg: { durationMs: true, tokensIn: true, tokensOut: true },
        _sum: { cost: true },
        where: { agent: { not: null } },
      }),
    ]);

  const totalTraces = traceStats._count;

  // Escalation rate: spans with agent "fixer" or "specialist" vs total execution spans
  const [escalationCount, totalExecutionSpans] = await Promise.all([
    prisma.span.count({
      where: { agent: { in: ["fixer", "specialist"] } },
    }),
    prisma.span.count({
      where: { role: "execution" },
    }),
  ]);

  res.json({
    totalTraces,
    successRate: totalTraces > 0 ? successCount / totalTraces : 0,
    avgDurationMs: traceStats._avg.durationMs,
    totalCost: traceStats._sum.totalCost ?? 0,
    costByModel,
    agentStats,
    escalationRate:
      totalExecutionSpans > 0 ? escalationCount / totalExecutionSpans : 0,
  });
});
