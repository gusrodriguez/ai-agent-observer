import { useState, useEffect } from "react";
import { fetchTraces, type TraceListResponse } from "../api/client";
import TraceTable from "../components/TraceTable";
import FilterBar from "../components/FilterBar";

export default function TraceList() {
  const [data, setData] = useState<TraceListResponse | null>(null);
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTraces({ status: status || undefined, tag: tag || undefined, page })
      .then(setData)
      .finally(() => setLoading(false));
  }, [status, tag, page]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Traces</h2>
      <FilterBar
        status={status}
        tag={tag}
        onStatusChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        onTagChange={(t) => {
          setTag(t);
          setPage(1);
        }}
      />
      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading...</p>
      ) : data ? (
        <>
          <TraceTable traces={data.traces} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>
                Page {page} of {totalPages} ({data.total} traces)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
