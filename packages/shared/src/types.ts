import type { Prisma } from "@prisma/client";

export type { TraceStatus, SpanStatus } from "@prisma/client";

export type Trace = Prisma.TraceGetPayload<{}>;

export type Span = Prisma.SpanGetPayload<{}>;

export type Event = Prisma.EventGetPayload<{}>;

export type SpanWithEvents = Prisma.SpanGetPayload<{
  include: { events: true };
}>;

export type TraceWithSpans = Prisma.TraceGetPayload<{
  include: {
    spans: {
      include: { events: true };
    };
  };
}>;

export type TraceListItem = Prisma.TraceGetPayload<{
  include: { _count: { select: { spans: true } } };
}>;
