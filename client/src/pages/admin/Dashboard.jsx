import React, { useState } from "react";
import { NavLink } from "react-router-dom";
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
  FaHome,
  FaRegFileAlt,
  FaUserPlus,
  FaTimesCircle,
  FaBars,
  FaTimes,
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

const sidebarItems = [
  { title: "Dashboard", icon: <FaHome />, to: "/dashboard" },
  { title: "Add Stock", icon: <FaRegFileAlt />, to: "/dashboard/add-stock" },
  { title: "Add User", icon: <FaUserPlus />, to: "/dashboard/add-user" },
  { title: "Order History", icon: <FaRegFileAlt />, to: "/dashboard/order-history" },
  { title: "Cancelled Orders", icon: <FaTimesCircle />, to: "/dashboard/cancelled-orders" },
];

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative overflow-hidden">
      <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-[#d70652]/10 blur-3xl"></div>
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-[#ff025e]/10 blur-3xl"></div>

      <div className="relative z-10 flex min-h-screen">
        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-30 bg-black/30 lg:bg-black/10"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[300px] border-r border-[#ff025e]/10 bg-white/80 shadow-lg backdrop-blur-md transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="border-b border-[#ff025e]/10 px-6 py-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gradient-to-br from-[#d70652] to-[#ff025e] p-2 shadow">
                  <span className="font-bold text-white">AFMC</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-800">MESS</h1>
                  <p className="text-xs text-gray-500">Admin Panel</p>
                </div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-[#d70652] to-[#ff025e] p-2 shadow">
                <button
                  type="button"
                  aria-label="Close sidebar"
                  className="text-white"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <FaTimes className="text-lg" />
                </button>
              </div>
            </div>
          </div>

          <nav className="space-y-2 px-3 py-4">
            {sidebarItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.to}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-4 rounded-2xl px-4 py-4 text-[18px] font-medium transition-all ${
                    isActive
                      ? "bg-[#f6f2f3] text-gray-900 shadow-sm"
                      : "text-slate-600 hover:bg-[#faf6f7] hover:text-gray-900"
                  }`
                }
              >
                <span className="text-[24px]">{item.icon}</span>
                <span>{item.title}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          <div className="flex items-center justify-between border-b border-[#ff025e]/10 bg-white/70 px-8 py-4 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-4">
              <button
                type="button"
                aria-label={isSidebarOpen ? "Toggle sidebar closed" : "Toggle sidebar open"}
                className="rounded-xl border border-[#ff025e]/15 bg-white p-3 text-gray-700 shadow-sm"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
              >
                {isSidebarOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
              </button>

              <div>
                <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
                <p className="text-sm text-gray-500">Overview of mess management</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative">
                <FaBell className="cursor-pointer text-lg text-gray-600" />
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#d70652] text-xs text-white">
                  2
                </span>
              </div>

              <div className="flex cursor-pointer items-center gap-2">
                <FaUserCircle className="text-2xl text-gray-600" />
                <span className="text-sm text-gray-700">vignesh@gmail.com</span>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {menuItems.map((item, index) => (
                <div
                  key={index}
                  className="flex cursor-pointer items-center gap-5 rounded-2xl border border-white/40 bg-white/70 p-6 shadow-md transition-all hover:scale-[1.02] hover:shadow-xl backdrop-blur-md"
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full ${item.color}`}>
                    <span className="text-xl">{item.icon}</span>
                  </div>

                  <h3 className="text-md font-semibold text-gray-700">
                    {item.title}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
