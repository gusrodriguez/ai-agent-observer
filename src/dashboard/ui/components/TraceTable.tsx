import { useNavigate } from "react-router-dom";
import type { TraceListItem } from "../services";
import StatusBadge from "./StatusBadge";
import CostBadge from "./CostBadge";
import { formatDuration, formatDate } from "../lib/format";

export default function TraceTable({ traces }: { traces: TraceListItem[] }) {
  const navigate = useNavigate();

  if (traces.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-8 text-center">
        No traces found.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-left text-gray-400">
          <th className="pb-2 font-medium">Status</th>
          <th className="pb-2 font-medium">Name</th>
          <th className="pb-2 font-medium">Tags</th>
          <th className="pb-2 font-medium text-right">Spans</th>
          <th className="pb-2 font-medium text-right">Duration</th>
          <th className="pb-2 font-medium text-right">Cost</th>
          <th className="pb-2 font-medium text-right">Started</th>
        </tr>
      </thead>
      <tbody>
        {traces.map((trace) => (
          <tr
            key={trace.id}
            onClick={() => navigate(`/traces/${trace.id}`)}
            className="border-b border-gray-800/50 cursor-pointer hover:bg-gray-900 transition-colors"
          >
            <td className="py-3">
              <StatusBadge status={trace.status} />
            </td>
            <td className="py-3 font-medium text-gray-200">{trace.name}</td>
            <td className="py-3">
              <div className="flex gap-1">
                {trace.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </td>
            <td className="py-3 text-right text-gray-400">
              {trace._count.spans}
            </td>
            <td className="py-3 text-right font-mono text-gray-400">
              {formatDuration(trace.durationMs)}
            </td>
            <td className="py-3 text-right">
              <CostBadge cost={trace.totalCost} />
            </td>
            <td className="py-3 text-right text-gray-400">
              {formatDate(trace.startedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
