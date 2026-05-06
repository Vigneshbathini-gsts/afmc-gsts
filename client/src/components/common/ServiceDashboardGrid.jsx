import React from "react";
import { HeartPulse, Scissors, Wine } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const defaultItems = [
  { name: "Pubmed", color: "bg-blue-600", icon: Wine, menu: true },
  { name: "Synapse", color: "bg-slate-600", icon: Wine, menu: true },
  { name: "Blue Room", color: "bg-teal-600", icon: Wine, menu: true },
  { name: "Silver Room", color: "bg-green-600", icon: Wine, menu: true },
  { name: "Grove", color: "bg-green-800", icon: Wine, menu: true },
  { name: "Tapovan", color: "bg-gray-600", icon: Wine, menu: true },
  { name: "Madhuban", color: "bg-yellow-700", icon: Wine, menu: true },
  { name: "Lounge Room", color: "bg-orange-600", icon: Wine, menu: true },
  { name: "Pizza", color: "bg-red-600", icon: Wine, menu: true },
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

function DashboardCard({ item, menuPath }) {
  const navigate = useNavigate();
  const Icon = item.icon;

  const handleClick = () => {
    const path = item.Path || (item.menu ? menuPath : null);
    if (path) {
      navigate(path);
    }
  };

  return (
    <div onClick={handleClick}>
      <div className="flex items-center gap-4 rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full text-white ${item.color}`}
        >
          <Icon size={22} />
        </div>

        <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-afmc-gold/30 to-transparent" />
      </div>
    </div>
  );
}

export default function ServiceDashboardGrid({ items = defaultItems }) {
  const location = useLocation();
  const menuPath = location.pathname.startsWith("/attendant")
    ? "/attendant/menudash"
    : "/user/menudash";

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-afmc-maroon">Services</h1>
          <p className="mt-1 text-sm text-gray-600">Select a location to continue.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <DashboardCard key={item.name} item={item} menuPath={menuPath} />
        ))}
      </div>
      </div>
    </div>
  );
}
