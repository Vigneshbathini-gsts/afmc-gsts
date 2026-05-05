import React, { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";

const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

function formatPrice(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return "0.00";
  }
  return numericValue.toFixed(2);
}

export function MenuGrid({ items, showStockStatus = false, onItemClick }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {items.map((item, index) => (
        <button
          type="button"
          onClick={() => onItemClick?.(item)}
          key={item.item_id || item.item_code || `${item.item_name}-${index}`}
          className="group relative overflow-hidden rounded-xl border border-gray-300 bg-white text-left shadow-sm transition-all duration-300 hover:shadow-md hover:border-afmc-maroon/50 focus:outline-none focus:ring-2 focus:ring-afmc-maroon"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
            <img
              src={`${BASEAPI}${item.image || "default.jpg"}`}
              alt={item.item_name}
              className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            />

            {showStockStatus && item.stock_status && (
              <div className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white shadow">
                {item.stock_status}
              </div>
            )}
          </div>

          <div className="space-y-2 p-3">
            <div className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900">
              {item.item_name}
            </div>

            {item.unit_price ? (
              <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                <div className="text-lg font-bold text-afmc-maroon">
                  ₹{formatPrice(item.unit_price)}
                </div>
                <div className="flex items-center gap-0.5 rounded bg-amber-50 px-2 py-0.5">
                  <Star size={12} className="text-amber-500" fill="currentColor" />
                  <span className="text-xs font-bold text-gray-700">4.5</span>
                </div>
              </div>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

export function MenuGridSkeleton({ count = 15 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm"
        >
          <div className="aspect-square w-full bg-gray-200" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-4/5 rounded bg-gray-200" />
            <div className="h-3 w-3/4 rounded bg-gray-200" />
            <div className="h-8 w-full rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function BottomLoader({ label = "Loading more..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6 text-sm font-semibold text-gray-600">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-afmc-maroon" />
      {label}
    </div>
  );
}

export function ProgressiveMenuGrid({
  items,
  showStockStatus = false,
  onItemClick,
  initialCount = 20,
  step = 20,
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const sentinelRef = React.useRef(null);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items, initialCount]);

  const hasMore = visibleCount < items.length;
  const slice = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  useEffect(() => {
    if (!hasMore) return undefined;
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(items.length, prev + step));
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, items.length, step]);

  return (
    <div>
      <MenuGrid items={slice} showStockStatus={showStockStatus} onItemClick={onItemClick} />
      {hasMore ? <BottomLoader /> : null}
      <div ref={sentinelRef} />
    </div>
  );
}

