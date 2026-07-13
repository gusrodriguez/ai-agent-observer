import { AsyncLocalStorage } from "node:async_hooks";

interface ObserveContext {
  traceId: string;
  spanId: string | null;
}

const storage = new AsyncLocalStorage<ObserveContext>();

export function getActiveTrace(): string | undefined {
  return storage.getStore()?.traceId;
}

export function getActiveSpan(): string | undefined {
  return storage.getStore()?.spanId ?? undefined;
}

export function runWithContext<T>(ctx: ObserveContext, fn: () => T): T {
  return storage.run(ctx, fn);
}
