import { formatCost } from "../lib/format";

export default function CostBadge({
  cost,
}: {
  cost: number | null | undefined;
}) {
  return (
    <span className="font-mono text-sm text-gray-300">{formatCost(cost)}</span>
  );
}
