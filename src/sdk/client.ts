import { Redis } from "ioredis";
import { TraceHandle, NoopTraceHandle } from "./trace.js";
import type { TraceOptions } from "./trace.js";
import { EventQueue } from "./queue.js";
import type { QueueOptions } from "./queue.js";

export interface ObserverConfig {
  redisUrl?: string;
  flushIntervalMs?: number;
  maxQueueSize?: number;
  streamKey?: string;
}

export interface Observer {
  startTrace(name: string, options?: TraceOptions): TraceHandle;
  shutdown(): Promise<void>;
}

export function initObserver(config: ObserverConfig = {}): Observer {
  const url = config.redisUrl;
  if (!url) return createNoopObserver();

  let redis: Redis;
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      retryStrategy: () => null, // don't retry — fire and forget
    });
  } catch {
    return createNoopObserver();
  }

  // Connect in the background — don't block the agent
  redis.connect().catch(() => {});

  // Suppress unhandled connection errors (Redis may be down)
  redis.on("error", () => {});

  const queue = new EventQueue(redis, {
    flushIntervalMs: config.flushIntervalMs,
    maxQueueSize: config.maxQueueSize,
    streamKey: config.streamKey,
  });

  let traceCounter = 0;
  function generateTraceId(): string {
    return `t_${Date.now()}_${++traceCounter}_${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    startTrace(name, options = {}) {
      const id = generateTraceId();
      const now = new Date();
      queue.push({
        kind: "trace",
        data: {
          id,
          name,
          tags: options.tags ?? [],
          metadata: options.metadata ?? null,
          startedAt: now.toISOString(),
        },
      });
      return new TraceHandle(queue, id, now);
    },

    async shutdown() {
      await queue.shutdown();
      await redis.quit().catch(() => {});
    },
  };
}

function createNoopObserver(): Observer {
  return {
    startTrace() {
      return new NoopTraceHandle();
    },
    async shutdown() {},
  };
}
