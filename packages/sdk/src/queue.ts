import type { Redis } from "ioredis";

export interface ObserverEvent {
  kind: "trace" | "span" | "span_update" | "trace_update" | "event";
  id?: string;
  data: Record<string, unknown>;
}

export interface QueueOptions {
  flushIntervalMs?: number;
  maxQueueSize?: number;
  streamKey?: string;
}

const DEFAULT_FLUSH_INTERVAL = 1500;
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_STREAM_KEY = "observer:events";

export class EventQueue {
  private queue: ObserverEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private readonly maxSize: number;
  private readonly streamKey: string;

  constructor(
    private redis: Redis,
    options: QueueOptions = {},
  ) {
    this.maxSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.streamKey = options.streamKey ?? DEFAULT_STREAM_KEY;
    const interval = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL;
    this.timer = setInterval(() => this.flush(), interval);
    this.timer.unref();
  }

  push(event: ObserverEvent): void {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift();
    }
    this.queue.push(event);
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const batch = this.queue.splice(0);

    try {
      const pipeline = this.redis.pipeline();
      for (const event of batch) {
        pipeline.xadd(
          this.streamKey,
          "*",
          "payload",
          JSON.stringify(event),
        );
      }
      await pipeline.exec();
    } catch {
      // Redis is down — drop the batch silently
    } finally {
      this.flushing = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
