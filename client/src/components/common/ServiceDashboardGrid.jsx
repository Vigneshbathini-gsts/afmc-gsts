import React from "react";
import {
  HeartPulse,
  Scissors,
  Wine,
  ChevronRight,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const defaultItems = [
  { name: "Pubmed", pubmedId: 10, color: "from-sky-600 to-cyan-500", icon: Wine, menu: true },
  { name: "Synapse", pubmedId: 20, color: "from-slate-600 to-slate-500", icon: Wine, menu: true },
  { name: "Blue Room", pubmedId: 30, color: "from-teal-600 to-emerald-500", icon: Wine, menu: true },
  { name: "Silver Room", pubmedId: 40, color: "from-green-600 to-green-500", icon: Wine, menu: true },
  { name: "Grove", pubmedId: 50, color: "from-lime-700 to-green-600", icon: Wine, menu: true },
  { name: "Tapovan", pubmedId: 60, color: "from-stone-600 to-stone-500", icon: Wine, menu: true },
  { name: "Madhuban", pubmedId: 70, color: "from-yellow-700 to-amber-600", icon: Wine, menu: true },
  {
    name: "Lounge Room",
    color: "from-orange-700 to-orange-500",
    icon: Wine,
    pending: true,
  },
  {
    name: "Pizza",
    color: "from-red-600 to-red-500",
    icon: Wine,
    pending: true,
  },
  {
    name: "Gym",
    color: "from-rose-700 to-pink-600",
    icon: HeartPulse,
    pending: true,
  },
  {
    name: "Saloon",
    color: "from-red-500 to-rose-500",
    icon: Scissors,
    pending: true,
  },
];

function DashboardCard({ item, menuPath }) {
  const navigate = useNavigate();
  const Icon = item.icon;

  const handleClick = () => {
    const path = item.Path || (item.menu ? menuPath : null);

    if (path && !item.pending) {
      const pubmedValue = item.pubmedId ?? item.pubmedName ?? item.name;
      const nextPath = item.menu
        ? `${path}?pubmed=${encodeURIComponent(pubmedValue)}&pubmedName=${encodeURIComponent(item.name)}`
        : path;

      navigate(nextPath, {
        state: item.menu ? { pubmed: pubmedValue, pubmedName: item.name } : undefined,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={item.pending}
      className="group relative w-full overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-75"
    >
      {/* subtle hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 opacity-90" />

      <div className="relative z-10 flex items-center gap-3">
        {/* Icon */}
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} text-white shadow-md`}
        >
          <Icon size={24} strokeWidth={2.2} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-gray-900">
              {item.name}
            </h3>

            {!item.pending ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-all group-hover:bg-afmc-maroon group-hover:text-white">
                <ChevronRight size={16} />
              </div>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                Soon
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {item.pending
              ? "Under development"
              : "Open service dashboard"}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function ServiceDashboardGrid({ items = defaultItems }) {
  const location = useLocation();

  const menuPath = location.pathname.startsWith("/attendant")
    ? "/attendant/menudash"
    : "/user/menudash";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f7f5] via-white to-[#f5f3ef] px-3 py-4 md:px-5">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
          <div>
            <h1 className="text-xl font-black tracking-tight text-afmc-maroon md:text-2xl">
              Services
            </h1>

            <p className="text-xs text-gray-500 md:text-sm">
              Quick access to all facilities
            </p>
          </div>

          
        </div>

        {/* Compact Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <DashboardCard
              key={item.name}
              item={item}
              menuPath={menuPath}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
