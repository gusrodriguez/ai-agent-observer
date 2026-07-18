import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Traces" },
  { to: "/analytics", label: "Analytics" },
];

export default function Layout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r border-gray-800 bg-gray-900 px-4 py-6 flex flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight mb-6 px-2">
          AI Agent Observe
        </h1>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
