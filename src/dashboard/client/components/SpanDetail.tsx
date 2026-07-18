import type { SpanDetail as SpanDetailType } from "../api/client";
import StatusBadge from "./StatusBadge";
import CostBadge from "./CostBadge";
import JsonViewer from "./JsonViewer";
import EventList from "./EventList";
import { formatDuration, formatTokens } from "../lib/format";
import { modelTierColors } from "../lib/colors";

export default function SpanDetailPanel({
  span,
}: {
  span: SpanDetailType;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 overflow-auto">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold">{span.name}</h3>
        <StatusBadge status={span.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {span.agent && (
          <>
            <dt className="text-gray-400">Agent</dt>
            <dd className="text-gray-200">{span.agent}</dd>
          </>
        )}
        {span.modelTier && (
          <>
            <dt className="text-gray-400">Model</dt>
            <dd>
              <span
                className={`rounded px-1.5 py-0.5 text-xs ${
                  modelTierColors[span.modelTier] ??
                  "bg-gray-700 text-gray-400"
                }`}
              >
                {span.modelTier}
              </span>
            </dd>
          </>
        )}
        {span.role && (
          <>
            <dt className="text-gray-400">Role</dt>
            <dd className="text-gray-200">{span.role}</dd>
          </>
        )}
        {span.phase && (
          <>
            <dt className="text-gray-400">Phase</dt>
            <dd className="text-gray-200">{span.phase}</dd>
          </>
        )}
        <dt className="text-gray-400">Duration</dt>
        <dd className="font-mono text-gray-200">
          {formatDuration(span.durationMs)}
        </dd>
        {(span.tokensIn != null || span.tokensOut != null) && (
          <>
            <dt className="text-gray-400">Tokens</dt>
            <dd className="font-mono text-gray-200">
              {formatTokens(span.tokensIn)} in / {formatTokens(span.tokensOut)}{" "}
              out
            </dd>
          </>
        )}
        {span.cost != null && (
          <>
            <dt className="text-gray-400">Cost</dt>
            <dd>
              <CostBadge cost={span.cost} />
            </dd>
          </>
        )}
      </dl>

      {span.error && (
        <div className="mt-4 rounded bg-red-500/10 border border-red-500/30 p-3">
          <p className="text-xs font-medium text-red-400 mb-1">Error</p>
          <p className="text-sm text-red-300">{span.error}</p>
        </div>
      )}

      <JsonViewer data={span.input} label="Input" />
      <JsonViewer data={span.output} label="Output" />

      <EventList events={span.events} />
    </div>
  );
}
