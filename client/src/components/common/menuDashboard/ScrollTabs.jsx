import React from "react";

export default function ScrollTabs({ items, activeKey, onChange, variant = "primary" }) {
  const base =
    "shrink-0 snap-start rounded-full px-4 py-2 text-sm font-bold ring-1 transition focus:outline-none focus:ring-2 focus:ring-afmc-maroon/20";
  const activeClass =
    variant === "primary"
      ? "bg-gradient-to-r from-afmc-maroon to-afmc-maroon/85 text-white ring-afmc-maroon/20 shadow-sm"
      : "bg-afmc-maroon text-white ring-afmc-maroon/20 shadow-sm";
  const inactiveClass =
    variant === "primary"
      ? "bg-white text-gray-700 ring-gray-200 hover:ring-afmc-maroon/25 hover:text-afmc-maroon"
      : "bg-white/80 text-gray-700 ring-gray-200 hover:bg-white hover:ring-afmc-maroon/20 hover:text-afmc-maroon";

  return (
    <div className="-mx-4 mb-6 px-4">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-gray-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-gray-50 to-transparent" />

        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 pr-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((it) => {
            const active = activeKey === it.key;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onChange(it.key)}
                className={`${base} ${active ? activeClass : inactiveClass}`}
                aria-current={active ? "page" : undefined}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

