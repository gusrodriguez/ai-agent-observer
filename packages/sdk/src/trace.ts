import type { PrismaClient } from "@prisma/client";
import { SpanHandle } from "./span.js";
import type { SpanOptions, TraceToolOptions } from "./span.js";

export interface TraceOptions {
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export class TraceHandle {
  constructor(
    private prisma: PrismaClient,
    public readonly id: string,
  ) {}

  async startSpan(
    name: string,
    options: SpanOptions = {},
  ): Promise<SpanHandle> {
    const span = await this.prisma.span.create({
      data: {
        traceId: this.id,
        parentSpanId: options.parentSpanId ?? null,
        name,
        agent: options.agent,
        modelTier: options.modelTier,
        role: options.role,
        phase: options.phase,
        input: options.input as any,
        metadata: options.metadata as any,
      },
    });
    return new SpanHandle(this.prisma, span.id, this.id);
  }

  async traceTool<T>(
    name: string,
    input: unknown,
    fn: () => Promise<T>,
    options: TraceToolOptions = {},
  ): Promise<T> {
    const span = await this.startSpan(name, {
      role: "tool",
      input,
      agent: options.agent,
      modelTier: options.modelTier,
      phase: options.phase,
      metadata: options.metadata,
    });
    try {
      const result = await fn();
      await span.end({ status: "SUCCESS", output: result as unknown });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await span.end({ status: "FAILURE", error: message });
      throw err;
    }
  }

  async end(status: "COMPLETED" | "FAILED" = "COMPLETED"): Promise<void> {
    const now = new Date();
    const trace = await this.prisma.trace.findUniqueOrThrow({
      where: { id: this.id },
      select: { startedAt: true },
    });

    const costAgg = await this.prisma.span.aggregate({
      where: { traceId: this.id },
      _sum: { cost: true },
    });

    await this.prisma.trace.update({
      where: { id: this.id },
      data: {
        status,
        endedAt: now,
        durationMs: now.getTime() - trace.startedAt.getTime(),
        totalCost: costAgg._sum.cost,
      },
    });
  }
}
