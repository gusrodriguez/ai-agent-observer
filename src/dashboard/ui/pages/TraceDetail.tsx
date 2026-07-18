import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchTrace, type TraceDetail as TraceDetailType, type SpanDetail as SpanDetailType } from "../services";
import StatusBadge from "../components/StatusBadge";
import CostBadge from "../components/CostBadge";
import SpanWaterfall from "../components/SpanWaterfall";
import SpanDetailPanel from "../components/SpanDetail";
import { formatDuration } from "../lib/format";

export default function TraceDetail() {
  const { id } = useParams<{ id: string }>();
  const [trace, setTrace] = useState<TraceDetailType | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<SpanDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchTrace(id)
      .then((t) => {
        setTrace(t);
        if (t.spans.length > 0) setSelectedSpan(t.spans[0]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-gray-500 text-sm py-8 text-center">Loading...</p>;
  }

  if (!trace) {
    return <p className="text-gray-500 text-sm py-8 text-center">Trace not found.</p>;
  }

  return (
    <div>
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 mb-4 block">
        &larr; Back to traces
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold">{trace.name}</h2>
        <StatusBadge status={trace.status} />
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
        <span className="font-mono">{formatDuration(trace.durationMs)}</span>
        <CostBadge cost={trace.totalCost} />
        <span>{trace.spans.length} spans</span>
        {trace.tags.map((t) => (
          <span key={t} className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">
            {t}
          </span>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <SpanWaterfall
            spans={trace.spans}
            traceStartedAt={trace.startedAt}
            traceDurationMs={trace.durationMs ?? 1}
            selectedSpanId={selectedSpan?.id ?? null}
            onSelectSpan={setSelectedSpan}
          />
        </div>
        {selectedSpan && (
          <div className="w-96 shrink-0">
            <SpanDetailPanel span={selectedSpan} />
          </div>
        )}
      </div>
    </div>
  );
}
