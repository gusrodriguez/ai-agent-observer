import { Router } from "express";
import type { TraceStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export const tracesRouter = Router();

tracesRouter.get("/api/traces", async (req, res) => {
  const {
    status,
    tag,
    page = "1",
    pageSize = "25",
  } = req.query as Record<string, string>;

  const skip = (Number(page) - 1) * Number(pageSize);

  const where: Prisma.TraceWhereInput = {};
  if (status) where.status = status as TraceStatus;
  if (tag) where.tags = { has: tag };

  const [traces, total] = await Promise.all([
    prisma.trace.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take: Number(pageSize),
      include: { _count: { select: { spans: true } } },
    }),
    prisma.trace.count({ where }),
  ]);

  res.json({ traces, total, page: Number(page), pageSize: Number(pageSize) });
});

tracesRouter.get("/api/traces/:id", async (req, res) => {
  const trace = await prisma.trace.findUnique({
    where: { id: req.params.id },
    include: {
      spans: {
        orderBy: { startedAt: "asc" },
        include: { events: { orderBy: { timestamp: "asc" } } },
      },
    },
  });

  if (!trace) {
    res.status(404).json({ error: "Trace not found" });
    return;
  }
  res.json(trace);
});
