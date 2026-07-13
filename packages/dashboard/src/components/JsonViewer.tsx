import { useState } from "react";

export default function JsonViewer({
  data,
  label,
}: {
  data: unknown;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  if (data == null) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-gray-200 font-medium"
      >
        {open ? "- Hide" : "+ Show"} {label}
      </button>
      {open && (
        <pre className="mt-1 rounded bg-gray-950 p-3 text-xs text-gray-300 overflow-auto max-h-64">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
