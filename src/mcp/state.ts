import { initObserver } from "../sdk/index.js";
import type { TraceHandle, SpanHandle } from "../sdk/index.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const observer = initObserver({ redisUrl });
export const traces = new Map<string, TraceHandle>();
export const spans = new Map<string, SpanHandle>();
