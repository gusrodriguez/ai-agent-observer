import type { SpanDetail } from "../services";
import { statusBarColors, modelTierColors } from "../lib/colors";
import StatusBadge from "./StatusBadge";
import { formatDuration } from "../lib/format";

interface SpanNode extends SpanDetail {
  children: SpanNode[];
  depth: number;
}

function buildTree(spans: SpanDetail[]): SpanNode[] {
  const map = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const span of spans) {
    map.set(span.id, { ...span, children: [], depth: 0 });
  }

  for (const node of map.values()) {
    if (node.parentSpanId && map.has(node.parentSpanId)) {
      const parent = map.get(node.parentSpanId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function flatten(nodes: SpanNode[]): SpanNode[] {
  const result: SpanNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flatten(node.children));
  }
  return result;
}

interface Props {
  spans: SpanDetail[];
  traceStartedAt: string;
  traceDurationMs: number;
  selectedSpanId: string | null;
  onSelectSpan: (span: SpanDetail) => void;
}

export default function SpanWaterfall({
  spans,
  traceStartedAt,
  traceDurationMs,
  selectedSpanId,
  onSelectSpan,
}: Props) {
  const tree = buildTree(spans);
  const flat = flatten(tree);
  const traceStart = new Date(traceStartedAt).getTime();
  const totalMs = traceDurationMs || 1;

  return (
    <div className="space-y-0.5">
      {flat.map((span) => {
        const spanStart = new Date(span.startedAt).getTime();
        const left = ((spanStart - traceStart) / totalMs) * 100;
        const width = ((span.durationMs ?? 0) / totalMs) * 100;
        const barColor = statusBarColors[span.status] ?? "bg-gray-600";
        const isSelected = span.id === selectedSpanId;

        return (
          <div
            key={span.id}
            onClick={() => onSelectSpan(span)}
            className={`flex items-center cursor-pointer rounded px-2 py-1.5 transition-colors ${
              isSelected ? "bg-gray-800" : "hover:bg-gray-800/50"
            }`}
          >
            <div
              className="flex items-center gap-1.5 shrink-0 min-w-0"
              style={{ width: "280px", paddingLeft: `${span.depth * 16}px` }}
            >
              <span className="text-xs text-gray-300 truncate font-medium">
                {span.name}
              </span>
              {span.modelTier && (
                <span
                  className={`text-[10px] rounded px-1 py-0.5 shrink-0 ${
                    modelTierColors[span.modelTier] ??
                    "bg-gray-700 text-gray-400"
                  }`}
                >
                  {span.modelTier}
                </span>
              )}
            </div>
            <div className="flex-1 relative h-5 mx-2">
              <div className="absolute inset-0 bg-gray-800/30 rounded" />
              <div
                className={`absolute top-0 h-full rounded ${barColor} opacity-80`}
                style={{
                  left: `${Math.max(0, left)}%`,
                  width: `${Math.max(0.5, width)}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 w-32 justify-end">
              <span className="text-xs font-mono text-gray-500">
                {formatDuration(span.durationMs)}
              </span>
              <StatusBadge status={span.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
