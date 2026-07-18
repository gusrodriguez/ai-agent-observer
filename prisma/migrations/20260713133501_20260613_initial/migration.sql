-- CreateEnum
CREATE TYPE "TraceStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SpanStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILURE', 'SKIPPED');

-- CreateTable
CREATE TABLE "traces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TraceStatus" NOT NULL DEFAULT 'RUNNING',
    "metadata" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spans" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "parentSpanId" TEXT,
    "name" TEXT NOT NULL,
    "agent" TEXT,
    "modelTier" TEXT,
    "role" TEXT,
    "phase" TEXT,
    "status" "SpanStatus" NOT NULL DEFAULT 'RUNNING',
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "cost" DOUBLE PRECISION,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "spans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traces_status_idx" ON "traces"("status");

-- CreateIndex
CREATE INDEX "traces_startedAt_idx" ON "traces"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "traces_tags_idx" ON "traces" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "spans_traceId_idx" ON "spans"("traceId");

-- CreateIndex
CREATE INDEX "spans_parentSpanId_idx" ON "spans"("parentSpanId");

-- CreateIndex
CREATE INDEX "spans_traceId_startedAt_idx" ON "spans"("traceId", "startedAt");

-- CreateIndex
CREATE INDEX "spans_agent_idx" ON "spans"("agent");

-- CreateIndex
CREATE INDEX "spans_modelTier_idx" ON "spans"("modelTier");

-- CreateIndex
CREATE INDEX "events_spanId_timestamp_idx" ON "events"("spanId", "timestamp");

-- AddForeignKey
ALTER TABLE "spans" ADD CONSTRAINT "spans_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spans" ADD CONSTRAINT "spans_parentSpanId_fkey" FOREIGN KEY ("parentSpanId") REFERENCES "spans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_spanId_fkey" FOREIGN KEY ("spanId") REFERENCES "spans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
