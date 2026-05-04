import React from "react";
import { HeartPulse, Scissors, Wine } from "lucide-react";
import { useNavigate } from "react-router-dom";

const defaultItems = [
  { name: "Pubmed", color: "bg-blue-600", icon: Wine, Path: "/user/menudash" },
  { name: "Synapse", color: "bg-slate-600", icon: Wine, Path: "/user/menudash" },
  { name: "Blue Room", color: "bg-teal-600", icon: Wine, Path: "/user/menudash" },
  { name: "Silver Room", color: "bg-green-600", icon: Wine, Path: "/user/menudash" },
  { name: "Grove", color: "bg-green-800", icon: Wine, Path: "/user/menudash" },
  { name: "Tapovan", color: "bg-gray-600", icon: Wine, Path: "/user/menudash" },
  { name: "Madhuban", color: "bg-yellow-700", icon: Wine, Path: "/user/menudash" },
  { name: "Lounge Room", color: "bg-orange-600", icon: Wine, Path: "/user/menudash" },
  { name: "Pizza", color: "bg-red-600", icon: Wine, Path: "/user/menudash" },
  {
    name: "Gym",
    color: "bg-afmc-maroon",
    icon: HeartPulse,
    pending: true,
  },
  {
    name: "Saloon",
    color: "bg-red-500",
    icon: Scissors,
    pending: true,
  },
];

function DashboardCard({ item }) {
  const navigate = useNavigate();
  const Icon = item.icon;
  const isDisabled = Boolean(item.pending) || !item.Path;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && navigate(item.Path)}
      disabled={isDisabled}
      className={`group w-full overflow-hidden rounded-2xl border bg-white/80 p-4 text-left shadow-sm backdrop-blur-sm transition
        hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-afmc-maroon2/25
        ${isDisabled ? "cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-sm" : ""}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-sm ring-1 ring-black/5 transition group-hover:scale-[1.03] ${item.color}`}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="truncate text-[15px] font-semibold tracking-[0.01em] text-gray-900">
              {item.name}
            </h3>
            {item.pending ? (
              <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                Coming soon
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-afmc-maroon/5 px-2.5 py-1 text-[11px] font-semibold text-afmc-maroon ring-1 ring-afmc-gold/25">
                Open
              </span>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-xs text-gray-600">
            {item.pending
              ? "This section is in the pipeline."
              : "Browse menu and place orders."}
          </p>
        </div>
      </div>

      <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-afmc-gold/30 to-transparent" />
    </button>
  );
}

export default function ServiceDashboardGrid({ items = defaultItems }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-afmc-maroon">Services</h1>
          <p className="mt-1 text-sm text-gray-600">
            Select a location to continue.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <DashboardCard key={item.name} item={item} />
        ))}
      </div>
      </div>
    </div>
  );
}
