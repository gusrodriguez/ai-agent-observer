interface FilterBarProps {
  status: string;
  tag: string;
  onStatusChange: (status: string) => void;
  onTagChange: (tag: string) => void;
}

const statuses = ["", "RUNNING", "COMPLETED", "FAILED"];

export default function FilterBar({
  status,
  tag,
  onStatusChange,
  onTagChange,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-600"
      >
        <option value="">All statuses</option>
        {statuses
          .filter(Boolean)
          .map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
      </select>
      <input
        type="text"
        placeholder="Filter by tag..."
        value={tag}
        onChange={(e) => onTagChange(e.target.value)}
        className="rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600"
      />
    </div>
  );
}
