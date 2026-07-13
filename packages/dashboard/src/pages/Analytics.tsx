import { useState, useEffect } from "react";
import { fetchAnalytics, type AnalyticsData } from "../api/client";
import StatsCard from "../components/StatsCard";
import { formatDuration, formatCost } from "../lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const MODEL_COLORS: Record<string, string> = {
  haiku: "#8b5cf6",
  sonnet: "#f59e0b",
  opus: "#f43f5e",
};

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="text-gray-500 text-sm py-8 text-center">Loading...</p>
    );
  }

  if (!data) return null;

  const costChartData = data.costByModel.map((m) => ({
    name: m.modelTier ?? "unknown",
    cost: m._sum.cost ?? 0,
    count: m._count,
  }));

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Analytics</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatsCard label="Total Traces" value={String(data.totalTraces)} />
        <StatsCard
          label="Success Rate"
          value={`${(data.successRate * 100).toFixed(0)}%`}
        />
        <StatsCard
          label="Avg Duration"
          value={formatDuration(data.avgDurationMs)}
        />
        <StatsCard label="Total Cost" value={formatCost(data.totalCost)} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Cost by Model Tier
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costChartData}>
              <XAxis
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "6px",
                  color: "#e5e7eb",
                }}
                formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                {costChartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={MODEL_COLORS[entry.name] ?? "#6b7280"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Escalation Rate
          </h3>
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <p className="text-4xl font-bold">
                {(data.escalationRate * 100).toFixed(0)}%
              </p>
              <p className="text-sm text-gray-400 mt-1">
                of execution spans required escalation
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          Agent Performance
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="pb-2 font-medium">Agent</th>
              <th className="pb-2 font-medium text-right">Invocations</th>
              <th className="pb-2 font-medium text-right">Avg Duration</th>
              <th className="pb-2 font-medium text-right">Avg Tokens In</th>
              <th className="pb-2 font-medium text-right">Avg Tokens Out</th>
              <th className="pb-2 font-medium text-right">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.agentStats.map((a) => (
              <tr
                key={a.agent}
                className="border-b border-gray-800/50"
              >
                <td className="py-2 font-medium text-gray-200">
                  {a.agent}
                </td>
                <td className="py-2 text-right text-gray-400">{a._count}</td>
                <td className="py-2 text-right font-mono text-gray-400">
                  {formatDuration(a._avg.durationMs)}
                </td>
                <td className="py-2 text-right font-mono text-gray-400">
                  {a._avg.tokensIn?.toFixed(0) ?? "-"}
                </td>
                <td className="py-2 text-right font-mono text-gray-400">
                  {a._avg.tokensOut?.toFixed(0) ?? "-"}
                </td>
                <td className="py-2 text-right font-mono text-gray-300">
                  {formatCost(a._sum.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
