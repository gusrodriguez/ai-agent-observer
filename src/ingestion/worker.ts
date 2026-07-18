import { Redis } from "ioredis";
import { PrismaClient } from "@prisma/client";

const STREAM_KEY = "observer:events";
const GROUP_NAME = "observer-ingestion";
const CONSUMER_NAME = `worker-${process.pid}`;
const BATCH_SIZE = 100;
const BLOCK_MS = 2000;

interface ObserverEvent {
  kind: "trace" | "span" | "span_update" | "trace_update" | "event";
  id?: string;
  data: Record<string, unknown>;
}

export async function startWorker(redisUrl: string, databaseUrl: string) {
  const redis = new Redis(redisUrl);
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  // Create consumer group (ignore if it already exists)
  try {
    await redis.xgroup("CREATE", STREAM_KEY, GROUP_NAME, "0", "MKSTREAM");
  } catch (err: any) {
    if (!err.message?.includes("BUSYGROUP")) throw err;
  }

  let running = true;

  async function processMessages() {
    while (running) {
      let messages: [string, [string, string[]][]][];

      try {
        const result = await redis.xreadgroup(
          "GROUP",
          GROUP_NAME,
          CONSUMER_NAME,
          "COUNT",
          BATCH_SIZE,
          "BLOCK",
          BLOCK_MS,
          "STREAMS",
          STREAM_KEY,
          ">",
        );
        if (!result) continue;
        messages = result as any;
      } catch (err) {
        if (!running) break;
        console.error("Redis read error, retrying...", err);
        await sleep(1000);
        continue;
      }

      for (const [, entries] of messages) {
        if (entries.length === 0) continue;

        const events: { messageId: string; event: ObserverEvent }[] = [];

        for (const [messageId, fields] of entries) {
          // Fields are [key, value, key, value, ...] — we send "payload" <json>
          const payloadIndex = fields.indexOf("payload");
          if (payloadIndex === -1 || payloadIndex + 1 >= fields.length) continue;

          try {
            const event = JSON.parse(fields[payloadIndex + 1]) as ObserverEvent;
            events.push({ messageId, event });
          } catch {
            // Malformed message — acknowledge and skip
            await redis.xack(STREAM_KEY, GROUP_NAME, messageId);
          }
        }

        if (events.length === 0) continue;

        try {
          // Sort: traces first, then root spans, then child spans, then updates, then events.
          // This ensures foreign key constraints are satisfied within a sequential transaction.
          const kindOrder: Record<string, number> = {
            trace: 0,
            span: 1,
            span_update: 2,
            trace_update: 3,
            event: 4,
          };

          const sorted = [...events].sort((a, b) => {
            const ka = kindOrder[a.event.kind] ?? 9;
            const kb = kindOrder[b.event.kind] ?? 9;
            if (ka !== kb) return ka - kb;
            // For spans: root spans (no parentSpanId) before child spans
            if (a.event.kind === "span" && b.event.kind === "span") {
              const aHasParent = a.event.data.parentSpanId != null;
              const bHasParent = b.event.data.parentSpanId != null;
              if (aHasParent !== bHasParent) return aHasParent ? 1 : -1;
            }
            return 0;
          });

          // Use sequential transaction to respect ordering
          await prisma.$transaction(async (tx) => {
            for (const { event } of sorted) {
              switch (event.kind) {
                case "trace":
                  await tx.trace.create({ data: event.data as any });
                  break;
                case "span":
                  await tx.span.create({ data: event.data as any });
                  break;
                case "span_update":
                  await tx.span.update({
                    where: { id: event.id },
                    data: event.data as any,
                  });
                  break;
                case "trace_update":
                  await tx.trace.update({
                    where: { id: event.id },
                    data: event.data as any,
                  });
                  break;
                case "event":
                  await tx.event.create({ data: event.data as any });
                  break;
              }
            }
          });

          // Acknowledge all processed messages
          const ids = events.map((e) => e.messageId);
          await redis.xack(STREAM_KEY, GROUP_NAME, ...ids);
        } catch (err) {
          // Postgres write failed — messages stay unacknowledged for retry
          console.error("Postgres write failed, will retry batch:", err);
          await sleep(1000);
        }
      }
    }
  }

  function shutdown() {
    console.log("Shutting down ingestion worker...");
    running = false;
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`Ingestion worker started (consumer: ${CONSUMER_NAME})`);
  console.log(`Reading from ${STREAM_KEY} → writing to Postgres`);

  await processMessages();

  await redis.quit();
  await prisma.$disconnect();
  console.log("Ingestion worker stopped.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
