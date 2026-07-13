import { SpanHandle, NoopSpanHandle, generateSpanId } from "./span.js";
import type { SpanOptions, TraceToolOptions } from "./span.js";
import type { EventQueue } from "./queue.js";

export interface TraceOptions {
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export class TraceHandle {
  constructor(
    private queue: EventQueue,
    public readonly id: string,
    private readonly startedAt: Date,
  ) {}

  startSpan(
    name: string,
    options: SpanOptions = {},
  ): SpanHandle {
    const id = generateSpanId();
    const now = new Date();
    this.queue.push({
      kind: "span",
      data: {
        id,
        traceId: this.id,
        parentSpanId: options.parentSpanId ?? null,
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
    return new SpanHandle(this.queue, id, this.id, now);
  }

  traceTool<T>(
    name: string,
    input: unknown,
    fn: () => Promise<T>,
    options: TraceToolOptions = {},
  ): Promise<T> {
    const span = this.startSpan(name, {
      role: "tool",
      input,
      agent: options.agent,
      modelTier: options.modelTier,
      phase: options.phase,
      metadata: options.metadata,
    });
    return fn().then(
      (result) => {
        span.end({ status: "SUCCESS", output: result as unknown });
        return result;
      },
      (err) => {
        const message = err instanceof Error ? err.message : String(err);
        span.end({ status: "FAILURE", error: message });
        throw err;
      },
    );
  }

  end(status: "COMPLETED" | "FAILED" = "COMPLETED"): void {
    const now = new Date();
    this.queue.push({
      kind: "trace_update",
      id: this.id,
      data: {
        status,
        endedAt: now.toISOString(),
        durationMs: now.getTime() - this.startedAt.getTime(),
      },
    });
  }
}

/** No-op trace that does nothing. Returned when the observer is unavailable. */
export class NoopTraceHandle extends TraceHandle {
  constructor() {
    super(null as any, "", new Date());
  }
  startSpan(): SpanHandle {
    return new NoopSpanHandle();
  }
  traceTool<T>(
    _name: string,
    _input: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }
  end(): void {}
}
