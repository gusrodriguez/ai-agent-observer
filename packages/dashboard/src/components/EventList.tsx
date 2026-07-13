import type { EventDetail } from "../api/client";
import { formatDate } from "../lib/format";

export default function EventList({ events }: { events: EventDetail[] }) {
  if (events.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        Events
      </h4>
      <div className="space-y-2">
        {events.map((e) => (
          <div
            key={e.id}
            className="rounded bg-gray-950 border border-gray-800 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-300 bg-gray-800 rounded px-1.5 py-0.5">
                {e.type}
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(e.timestamp)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-300">{e.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
