export const statusColors: Record<string, string> = {
  RUNNING: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
  SUCCESS: "bg-emerald-500/20 text-emerald-400",
  FAILED: "bg-red-500/20 text-red-400",
  FAILURE: "bg-red-500/20 text-red-400",
  SKIPPED: "bg-gray-500/20 text-gray-400",
};

export const statusBarColors: Record<string, string> = {
  RUNNING: "bg-blue-500",
  SUCCESS: "bg-emerald-500",
  FAILURE: "bg-red-500",
  SKIPPED: "bg-gray-500",
};

export const modelTierColors: Record<string, string> = {
  haiku: "bg-violet-500/20 text-violet-400",
  sonnet: "bg-amber-500/20 text-amber-400",
  opus: "bg-rose-500/20 text-rose-400",
};
