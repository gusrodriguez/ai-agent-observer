import type { PrismaClient } from "@prisma/client";

export interface SpanOptions {
  parentSpanId?: string;
  agent?: string;
  modelTier?: string;
  role?: string;
  phase?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
}

export interface EndSpanOptions {
  status?: "SUCCESS" | "FAILURE" | "SKIPPED";
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  output?: unknown;
  error?: string;
}

export interface TraceToolOptions {
  agent?: string;
  modelTier?: string;
  phase?: string;
  metadata?: Record<string, unknown>;
}

export class SpanHandle {
  constructor(
    private prisma: PrismaClient,
    public readonly id: string,
    public readonly traceId: string,
  ) {}

  async startSpan(
    name: string,
    options: Omit<SpanOptions, "parentSpanId"> = {},
  ): Promise<SpanHandle> {
    const span = await this.prisma.span.create({
      data: {
        traceId: this.traceId,
        parentSpanId: this.id,
        name,
        agent: options.agent,
        modelTier: options.modelTier,
        role: options.role,
        phase: options.phase,
        input: options.input as any,
        metadata: options.metadata as any,
      },
    });
    return new SpanHandle(this.prisma, span.id, this.traceId);
  }

  async addEvent(
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.event.create({
      data: {
        spanId: this.id,
        type,
        message,
        metadata: metadata as any,
      },
    });
  }

  async traceTool<T>(
    name: string,
    input: unknown,
    fn: () => Promise<T>,
    options: TraceToolOptions = {},
  ): Promise<T> {
    const child = await this.startSpan(name, {
      role: "tool",
      input,
      agent: options.agent,
      modelTier: options.modelTier,
      phase: options.phase,
      metadata: options.metadata,
    });
    try {
      const result = await fn();
      await child.end({ status: "SUCCESS", output: result as unknown });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await child.end({ status: "FAILURE", error: message });
      throw err;
    }
  }

  async end(options: EndSpanOptions = {}): Promise<void> {
    const now = new Date();
    const span = await this.prisma.span.findUniqueOrThrow({
      where: { id: this.id },
      select: { startedAt: true },
    });

    await this.prisma.span.update({
      where: { id: this.id },
      data: {
        status: options.status ?? "SUCCESS",
        tokensIn: options.tokensIn,
        tokensOut: options.tokensOut,
        cost: options.cost,
        output: options.output as any,
        error: options.error,
        endedAt: now,
        durationMs: now.getTime() - span.startedAt.getTime(),
      },
    });
  }
}
