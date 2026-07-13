import type { EventQueue } from "./queue.js";

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

let spanCounter = 0;
export function generateSpanId(): string {
  return `s_${Date.now()}_${++spanCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export class SpanHandle {
  constructor(
    private queue: EventQueue,
    public readonly id: string,
    public readonly traceId: string,
    private readonly startedAt: Date,
  ) {}

  startSpan(
    name: string,
    options: Omit<SpanOptions, "parentSpanId"> = {},
  ): SpanHandle {
    const id = generateSpanId();
    const now = new Date();
    this.queue.push({
      kind: "span",
      data: {
        id,
        traceId: this.traceId,
        parentSpanId: this.id,
        name,
        agent: options.agent,
        modelTier: options.modelTier,
        role: options.role,
        phase: options.phase,
        input: options.input,
        metadata: options.metadata,
        startedAt: now.toISOString(),
      },
    });
    return new SpanHandle(this.queue, id, this.traceId, now);
  }

  addEvent(
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.queue.push({
      kind: "event",
      data: {
        spanId: this.id,
        type,
        message,
        metadata: metadata ?? null,
      },
    });
  }

  traceTool<T>(
    name: string,
    input: unknown,
    fn: () => Promise<T>,
    options: TraceToolOptions = {},
  ): Promise<T> {
    const child = this.startSpan(name, {
      role: "tool",
      input,
      agent: options.agent,
      modelTier: options.modelTier,
      phase: options.phase,
      metadata: options.metadata,
    });
    return fn().then(
      (result) => {
        child.end({ status: "SUCCESS", output: result as unknown });
        return result;
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err);
        child.end({ status: "FAILURE", error: message });
        throw err;
      },
    );
  }

  end(options: EndSpanOptions = {}): void {
    const now = new Date();
    this.queue.push({
      kind: "span_update",
      id: this.id,
      data: {
        status: options.status ?? "SUCCESS",
        tokensIn: options.tokensIn,
        tokensOut: options.tokensOut,
        cost: options.cost,
        output: options.output,
        error: options.error,
        endedAt: now.toISOString(),
        durationMs: now.getTime() - this.startedAt.getTime(),
      },
    });
  }
}

/** No-op span that does nothing. Returned when the observer is unavailable. */
export class NoopSpanHandle extends SpanHandle {
  constructor() {
    super(null as any, "", "", new Date());
  }
  startSpan(): SpanHandle {
    return this;
  }
  addEvent(): void {}
  traceTool<T>(
    _name: string,
    _input: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }
  end(): void {}
}
