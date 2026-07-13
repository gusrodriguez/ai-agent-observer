import { Router } from "express";
import { prisma } from "../prisma.js";

export const spansRouter = Router();

spansRouter.get("/api/spans/:id", async (req, res) => {
  const span = await prisma.span.findUnique({
    where: { id: req.params.id },
    include: { events: { orderBy: { timestamp: "asc" } } },
  });

  if (!span) {
    res.status(404).json({ error: "Span not found" });
    return;
  }
  res.json(span);
});
