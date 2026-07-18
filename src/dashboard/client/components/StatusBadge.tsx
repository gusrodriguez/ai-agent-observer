import { statusColors } from "../lib/colors";

export default function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? "bg-gray-500/20 text-gray-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {status}
    </span>
  );
}
