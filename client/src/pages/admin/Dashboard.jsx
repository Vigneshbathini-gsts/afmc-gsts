import React, { useEffect, useState } from "react";
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
  FaQuestionCircle,
  FaTimes,
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const finalMenu = menuItems.filter((item) =>
    item.roles.includes(Number(user?.roleId))
  );

  useEffect(() => {
    if (!isHelpOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") setIsHelpOpen(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isHelpOpen]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-20 left-20 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="px-0 py-4 md:p-8">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-afmc-maroon px-4 py-2 font-semibold text-white shadow transition hover:bg-afmc-maroon/90"
            aria-label="Open help manual"
          >
            <FaQuestionCircle />
            Help
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {finalMenu.map((item, index) => (
            <div
              key={index}
              onClick={() => item.path && navigate(item.path)}
              className="flex items-center gap-5 p-6 rounded-2xl bg-white/70 backdrop-blur-md border border-white/40 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
            >
              <div
                className={`w-14 h-14 flex items-center justify-center rounded-full ${item.color}`}
              >
                <span className="text-xl">{item.icon}</span>
              </div>

              <h3 className="text-md font-semibold text-gray-700">
                {item.title}
              </h3>
            </div>
          ))}
        </div>
      </div>

      {isHelpOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-manual-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsHelpOpen(false);
          }}
        >
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:w-[40vw] sm:min-w-[420px]">
            <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 sm:px-6">
              <h2 id="help-manual-title" className="truncate text-lg font-semibold text-afmc-maroon">
                AFMC Mess Application User Manual
              </h2>
              <div className="flex items-center gap-3">
                <a
                  href="/AFMC%20Mess%20Application%20User%20Manual.pdf"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-afmc-maroon hover:underline"
                >
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={() => setIsHelpOpen(false)}
                  className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="Close help manual"
                  title="Close"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
            <iframe
              title="AFMC Mess Application User Manual"
              src="/AFMC%20Mess%20Application%20User%20Manual.pdf"
              className="min-h-0 flex-1 bg-gray-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
