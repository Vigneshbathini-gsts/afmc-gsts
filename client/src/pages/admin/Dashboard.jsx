import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FaChartBar,
  FaTable,
  FaTags,
  FaDollarSign,
  FaExchangeAlt,
  FaCoins,
  FaWineGlassAlt,
} from "react-icons/fa";



// const Storemenu = [
//   {
//     title: "Inventory Management",
//     icon: <FaChartBar />,
//     color: "bg-blue-500/20 text-blue-600",
//     path: "/admin/inventory",
//   }
// ];

const menuItems = [
  {
    title: "Inventory Management",
    icon: <FaChartBar />,
    color: "bg-blue-500/20 text-blue-600",
    path: "/admin/inventory",
   roles: [10, 80],
  },
  {
    title: "Stock Reports",
    icon: <FaTable />,
    color: "bg-slate-500/20 text-slate-600",
    path: "/admin/stock-reports",
    roles: [10],
  },
  {
    title: "Offers",
    icon: <FaTags />,
    color: "bg-teal-500/20 text-teal-600",
    path: "/admin/offers",
    roles: [10],
  },
  {
    title: "Item Price",
    icon: <FaDollarSign />,
    color: "bg-green-500/20 text-green-600",
    path: "/admin/price-update",
    roles: [10],
  },
  {
    title: "Stock In/Out Report",
    icon: <FaExchangeAlt />,
    color: "bg-olive-500/20 text-green-700",
    path: "/admin/stock-in-out-report",
    roles: [10],
  },
  {
    title: "Profit Management",
    icon: <FaCoins />,
    color: "bg-gray-500/20 text-gray-700",
    path: "/admin/profit-management",
    roles: [10],
  },
  {
    title: "Cocktails/Mocktails",
    icon: <FaWineGlassAlt />,
    color: "bg-yellow-600/20 text-yellow-700",
    path: "/admin/cocktail-management",
    roles: [10],
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const finalMenu = menuItems.filter((item) =>
    item.roles.includes(Number(user?.roleId))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-20 left-20 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Dashboard
          </h1>
          <p className="mt-1 text-sm md:text-base text-gray-500">
            Welcome back! Select a service to continue.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {finalMenu.map((item, index) => (
            <div
              key={index}
              onClick={() => item.path && navigate(item.path)}
              className="flex items-center gap-4 md:gap-5 p-5 md:p-6 rounded-2xl bg-white/70 backdrop-blur-md border border-white/40 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div
                className={`w-12 h-12 md:w-14 md:h-14 flex-shrink-0 flex items-center justify-center rounded-full ${item.color}`}
              >
                <span className="text-lg md:text-xl">{item.icon}</span>
              </div>

              <h3 className="text-sm md:text-base font-semibold text-gray-700">
                {item.title}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
