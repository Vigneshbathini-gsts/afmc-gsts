import React from "react";
import { HeartPulse, Scissors, Wine } from "lucide-react";
import {useNavigate } from 'react-router-dom';

const defaultItems = [
  { name: "Pubmed", color: "bg-blue-600", icon: Wine ,Path : "/attendant/menudash"},
  { name: "Synapse", color: "bg-slate-600", icon: Wine,Path : "/attendant/menudash" },
  { name: "Blue Room", color: "bg-teal-600", icon: Wine,Path : "/attendant/menudash" },
  { name: "Silver Room", color: "bg-green-600", icon: Wine,Path : "/attendant/menudash" },
  { name: "Grove", color: "bg-green-800", icon: Wine,Path : "/attendant/menudash" },
  { name: "Tapovan", color: "bg-gray-600", icon: Wine,Path : "/attendant/menudash" },
  { name: "Madhuban", color: "bg-yellow-700", icon: Wine,Path : "/attendant/menudash" },
  { name: "Lounge Room", color: "bg-orange-600", icon: Wine ,Path : "/attendant/menudash"},
  { name: "Pizza", color: "bg-red-600", icon: Wine,Path : "/attendant/menudash" },
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
  const handleclick = (item) => {
    console.log("handle cliked");
    console.log(item.Path);
    if (item.Path) {
      navigate(item.Path)
    }
  }

  return (
    <div onClick={()=>handleclick(item)}>
    <div className="flex items-center gap-4 rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full text-white ${item.color}`}
      >
        <Icon size={22} />
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
        {item.pending && (
          <p className="mt-1 text-sm text-gray-500">
            Pending development. This section is in the pipeline.
          </p>
        )}
      </div>
      </div>
      </div>
  );
}

export default function ServiceDashboardGrid({ items = defaultItems }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 p-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <DashboardCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}
