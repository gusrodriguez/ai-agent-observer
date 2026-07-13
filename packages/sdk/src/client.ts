import { PrismaClient } from "@prisma/client";
import { TraceHandle } from "./trace.js";
import type { TraceOptions } from "./trace.js";

export interface ObserverConfig {
  databaseUrl?: string;
  prismaClient?: PrismaClient;
}

export interface Observer {
  startTrace(name: string, options?: TraceOptions): Promise<TraceHandle>;
  shutdown(): Promise<void>;
}

export function initObserver(config: ObserverConfig = {}): Observer {
  const prisma =
    config.prismaClient ??
    new PrismaClient({
      datasourceUrl: config.databaseUrl,
    });

  const ownsClient = !config.prismaClient;

  return {
    async startTrace(name, options = {}) {
      const trace = await prisma.trace.create({
        data: {
          name,
          tags: options.tags ?? [],
          metadata: options.metadata as any,
        },
      });
      return new TraceHandle(prisma, trace.id);
    },

    async shutdown() {
      if (ownsClient) {
        await prisma.$disconnect();
      }
    },
  };
}
