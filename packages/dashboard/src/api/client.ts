export interface TraceListResponse {
  traces: TraceListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TraceListItem {
  id: string;
  name: string;
  status: string;
  tags: string[];
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  totalCost: number | null;
  _count: { spans: number };
}

export interface TraceDetail {
  id: string;
  name: string;
  status: string;
  metadata: unknown;
  tags: string[];
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  totalCost: number | null;
  spans: SpanDetail[];
}

export interface SpanDetail {
  id: string;
  traceId: string;
  parentSpanId: string | null;
  name: string;
  agent: string | null;
  modelTier: string | null;
  role: string | null;
  phase: string | null;
  status: string;
  tokensIn: number | null;
  tokensOut: number | null;
  cost: number | null;
  input: unknown;
  output: unknown;
  error: string | null;
  metadata: unknown;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  events: EventDetail[];
}

export interface EventDetail {
  id: string;
  type: string;
  message: string;
  metadata: unknown;
  timestamp: string;
}

export interface AnalyticsData {
  totalTraces: number;
  successRate: number;
  avgDurationMs: number | null;
  totalCost: number;
  costByModel: {
    modelTier: string | null;
    _sum: { cost: number | null };
    _count: number;
    _avg: { durationMs: number | null };
  }[];
  agentStats: {
    agent: string | null;
    _count: number;
    _avg: {
      durationMs: number | null;
      tokensIn: number | null;
      tokensOut: number | null;
    };
    _sum: { cost: number | null };
  }[];
  escalationRate: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function fetchTraces(
  params: { status?: string; tag?: string; page?: number } = {},
): Promise<TraceListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.tag) qs.set("tag", params.tag);
  if (params.page) qs.set("page", String(params.page));
  return fetchJson(`/api/traces?${qs}`);
}

export function fetchTrace(id: string): Promise<TraceDetail> {
  return fetchJson(`/api/traces/${id}`);
}

export function fetchAnalytics(): Promise<AnalyticsData> {
  return fetchJson("/api/analytics");
}
