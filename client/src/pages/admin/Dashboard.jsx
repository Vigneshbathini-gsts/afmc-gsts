import React from "react";
import {
  FaChartBar,
  FaTable,
  FaTags,
  FaDollarSign,
  FaExchangeAlt,
  FaCoins,
  FaWineGlassAlt,
  FaBell,
  FaUserCircle,
} from "react-icons/fa";

const menuItems = [
  { title: "Inventory Management", icon: <FaChartBar />, color: "bg-blue-500/20 text-blue-600" },
  { title: "Stock Reports", icon: <FaTable />, color: "bg-slate-500/20 text-slate-600" },
  { title: "Offers", icon: <FaTags />, color: "bg-teal-500/20 text-teal-600" },
  { title: "Item Price", icon: <FaDollarSign />, color: "bg-green-500/20 text-green-600" },
  { title: "Stock In/Out Report", icon: <FaExchangeAlt />, color: "bg-olive-500/20 text-green-700" },
  { title: "Profit Management", icon: <FaCoins />, color: "bg-gray-500/20 text-gray-700" },
  { title: "Cocktails/Mocktails", icon: <FaWineGlassAlt />, color: "bg-yellow-600/20 text-yellow-700" },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative">

      {/* Background Blobs (same as login) */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#d70652]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#ff025e]/10 rounded-full blur-3xl"></div>

      

      {/* Dashboard Content */}
      <div className="p-8">

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-5 p-6 rounded-2xl bg-white/70 backdrop-blur-md border border-white/40 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div className={`w-14 h-14 flex items-center justify-center rounded-full ${item.color}`}>
                <span className="text-xl">{item.icon}</span>
              </div>

              <h3 className="text-md font-semibold text-gray-700">
                {item.title}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}