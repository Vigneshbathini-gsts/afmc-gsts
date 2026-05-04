import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { ChevronsLeft, ShoppingCart, Heart, Share2, Star, Flame, Leaf, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, offersAPI } from "../../services/api";

const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

const menuConfig = {
  drinks: {
    label: "Drinks",
    sections: {
      soft: {
        label: "Soft Drinks",
        categories: [
          { key: "Others", label: "Others" },
          { key: "Mocktail", label: "Mocktails" },
        ],
      },
      hard: {
        label: "Hard Drinks",
        categories: [],
      },
    },
  },
  snacks: {
    label: "Snacks",
    sections: {
      veg: {
        label: "Veg",
        categories: [],
      },
      nonVeg: {
        label: "Non-Veg",
        categories: [],
      },
    },
  },
};

const hardDrinkCategories = [
  { label: "Beer", value: "beer" },
  { label: "Brandy", value: "brandy" },
  { label: "Breezer", value: "breezer" },
  { label: "Vodka", value: "vodka" },
  { label: "Gin", value: "gin" },
  { label: "Rum", value: "rum" },
  { label: "Whisky", value: "whisky" },
  { label: "Wine", value: "wine" },
  { label: "Liquor", value: "liquor" },
  { label: "Tequila", value: "tequila" },
  { label: "Cocktail", value: "cocktail" },
];

function CategoryButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 transform ${
        active
          ? "bg-gradient-to-r from-afmc-maroon to-afmc-maroon/80 text-white shadow-lg shadow-afmc-maroon/30 scale-105"
          : "bg-white text-gray-700 ring-2 ring-gray-200 hover:ring-afmc-maroon/30 hover:text-afmc-maroon hover:shadow-md"
      }`}
    >
      {label}
    </button>
  );
}

function formatPrice(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return "0.00";
  }

  return numericValue.toFixed(2);
}

function isOfferActive(statusValue) {
  if (statusValue === true || statusValue === 1) return true;
  if (typeof statusValue === "string") {
    const normalized = statusValue.trim().toLowerCase();
    return ["active", "enabled", "yes", "y", "true", "1"].includes(normalized);
  }
  return false;
}

function formatOfferLine(offer) {
  const offerQty = Number(offer?.offer_quantity);
  const freeQty = Number(offer?.free_item_quantity);
  const itemName = offer?.item_name || "Item";
  const freeItemName = offer?.free_item || "Free item";

  if (!Number.isNaN(offerQty) && offerQty > 0 && freeItemName) {
    const freePart = !Number.isNaN(freeQty) && freeQty > 0 ? `Get ${freeQty}` : "Get";
    return `Buy ${offerQty} ${itemName} • ${freePart} ${freeItemName}`;
  }

  return offer?.message || `Offer on ${itemName}`;
}

function OfferIcon({ kind }) {
  const Icon = kind === "hot" ? Flame : kind === "new" ? Zap : kind === "veg" ? Leaf : Star;
  return <Icon className="h-4 w-4" />;
}

function OffersScroller({ offers, loading, onShare }) {
  const [likedIds, setLikedIds] = useState(() => new Set());

  const visibleOffers = useMemo(() => {
    const list = Array.isArray(offers) ? offers : [];
    const activeFirst = [...list].sort((a, b) => Number(isOfferActive(b?.status)) - Number(isOfferActive(a?.status)));
    return activeFirst.slice(0, 10);
  }, [offers]);

  if (loading) {
    return (
      <div className="mb-6">
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-[112px] w-[280px] shrink-0 animate-pulse rounded-2xl border border-gray-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  if (!visibleOffers.length) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Offers</h2>
          <p className="mt-0.5 text-xs text-gray-600">Swipe to see today’s deals</p>
        </div>
      </div>

      <div className="relative -mx-4 px-4">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleOffers.map((offer) => {
            const offerId = String(offer?.offer_id ?? offer?.id ?? `${offer?.item_code ?? "x"}-${offer?.free_item_code ?? "y"}`);
            const active = isOfferActive(offer?.status);
            const liked = likedIds.has(offerId);
            const kind = active ? "hot" : "new";

            return (
              <div
                key={offerId}
                className="group relative w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="absolute inset-0 opacity-[0.18] transition group-hover:opacity-[0.28]">
                  <svg viewBox="0 0 600 240" className="h-full w-full">
                    <defs>
                      <linearGradient id={`g-${offerId}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#7a0b2e" />
                        <stop offset="55%" stopColor="#caa84a" />
                        <stop offset="100%" stopColor="#7a0b2e" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,160 C120,110 200,210 320,160 C440,110 500,40 600,90 L600,240 L0,240 Z"
                      fill={`url(#g-${offerId})`}
                    />
                    <circle cx="92" cy="70" r="18" fill={`url(#g-${offerId})`} opacity="0.6" />
                    <circle cx="520" cy="60" r="26" fill={`url(#g-${offerId})`} opacity="0.5" />
                  </svg>
                </div>

                <div className="relative p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-800 ring-1 ring-black/5">
                        <span className={`inline-flex items-center gap-1.5 ${active ? "text-red-700" : "text-afmc-maroon"}`}>
                          <OfferIcon kind={kind} />
                          {active ? "Active" : "Promo"}
                        </span>
                      </div>

                      <div className="mt-3 text-sm font-semibold leading-snug text-gray-900">
                        {formatOfferLine(offer)}
                      </div>

                      {offer?.message ? (
                        <div className="mt-1 line-clamp-2 text-xs text-gray-600">
                          {offer.message}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setLikedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(offerId)) next.delete(offerId);
                            else next.add(offerId);
                            return next;
                          })
                        }
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 ring-1 ring-black/5 transition hover:bg-white ${
                          liked ? "text-red-600" : "text-gray-700"
                        }`}
                        aria-label={liked ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onShare?.(offer)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 ring-1 ring-black/5 transition hover:bg-white"
                        aria-label="Share offer"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                      <ShoppingCart className="h-4 w-4 text-afmc-maroon" />
                      Add from menu below
                    </div>

                    <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-afmc-maroon ring-1 ring-black/5">
                      {offer?.offer_date ? String(offer.offer_date).slice(0, 10) : "Today"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MenuPopup({ item, loading, onClose }) {
  const [qty, setQty] = useState("1");
  const [remarks, setRemarks] = useState("Din");

  useEffect(() => {
    if (!item && !loading) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [item, loading, onClose]);

  if (!item && !loading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 py-6 backdrop-blur-sm overflow-y-auto overscroll-contain sm:items-center">
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-300 bg-white shadow-xl overflow-hidden max-h-[90vh]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-all hover:bg-red-100 hover:text-red-600 z-10 text-lg"
          aria-label="Close popup"
        >
          <FaTimes size={16} />
        </button>

        {loading ? (
          <div className="animate-pulse">
            <div className="h-64 w-full bg-gray-200" />
            <div className="p-6 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Image Section */}
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                <img
                  src={`${BASEAPI}${item?.image || "default.jpg"}`}
                  alt={item?.item_name || "Item"}
                  className="h-full w-full object-contain p-4"
                />
              </div>
            </div>

            {/* Header */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {item?.item_name || "-"}
              </h2>
              {item.stock_status && (
                <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded">
                  {item.stock_status}
                </span>
              )}
            </div>

            {/* Info Section */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-semibold">Price:</span>
                <span className="text-2xl font-bold text-afmc-maroon">
                  ₹{formatPrice(item?.unit_price)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-semibold">Unit:</span>
                <span className="text-gray-900 font-semibold">{item?.ac_unit || "Nos"}</span>
              </div>
            </div>

            {/* Form Controls */}
            <div className="space-y-3">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Quantity</label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty(String(Math.max(1, Number(qty) - 1)))}
                    className="px-4 py-2 hover:bg-gray-100 font-bold text-gray-700 text-lg"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="flex-1 text-center py-2 font-bold text-gray-900 border-l border-r border-gray-300 outline-none"
                  />
                  <button
                    onClick={() => setQty(String(Number(qty) + 1))}
                    className="px-4 py-2 hover:bg-gray-100 font-bold text-gray-700 text-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Type/Remarks */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Type</label>
                <select
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 font-semibold text-gray-800 outline-none focus:border-afmc-maroon focus:ring-1 focus:ring-afmc-maroon"
                >
                  <option value="Din">Dine In</option>
                  <option value="Take Away">Take Away</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-lg font-bold bg-afmc-maroon text-white transition-all hover:bg-afmc-maroon/90 active:scale-95"
              >
                Add to Cart
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-lg font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuGrid({ items, showStockStatus = false, onItemClick }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {items.map((item, index) => (
        <button
          type="button"
          onClick={() => onItemClick?.(item)}
          key={item.item_id || item.item_code || `${item.item_name}-${index}`}
          className="group relative overflow-hidden rounded-xl border border-gray-300 bg-white text-left shadow-sm transition-all duration-300 hover:shadow-md hover:border-afmc-maroon/50 focus:outline-none focus:ring-2 focus:ring-afmc-maroon"
        >
          {/* Image Container */}
          <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
            <img
              src={`${BASEAPI}${item.image || "default.jpg"}`}
              alt={item.item_name}
              className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            />

            {/* Stock Status Badge */}
            {showStockStatus && item.stock_status && (
              <div className="absolute left-2 top-2 rounded-md bg-red-600 text-white px-2 py-1 text-xs font-bold shadow">
                {item.stock_status}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2 p-3">
            <div className="line-clamp-2 text-sm font-semibold text-gray-900 leading-tight">
              {item.item_name}
            </div>

            {item.unit_price && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="text-lg font-bold text-afmc-maroon">
                  ₹{formatPrice(item.unit_price)}
                </div>
                <div className="flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded">
                  <Star size={12} className="text-amber-500" fill="currentColor" />
                  <span className="text-xs font-bold text-gray-700">4.5</span>
                </div>
              </div>
            )}

            {/* CTA Button */}
            {/* <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onItemClick?.(item);
              }}
              className="w-full mt-2 py-2 px-3 rounded-lg bg-afmc-maroon text-white text-xs font-bold transition-all duration-300 hover:bg-afmc-maroon/90 active:scale-95"
            >
              Add to Cart
            </button> */}
          </div>
        </button>
      ))}
    </div>
  );
}

function MenuGridSkeleton({ count = 9 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm animate-pulse"
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

function ProgressiveMenuGrid({
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

function MenuHeader({ onBack }) {
  return (
    <div className="border-b border-gray-300 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
            <p className="mt-0.5 text-xs text-gray-600">Select items to add to cart</p>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-100"
          >
            <ChevronsLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function ScrollTabs({ items, activeKey, onChange }) {
  return (
    <div className="-mx-4 mb-6 px-4">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const active = activeKey === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onChange(it.key)}
              className={`shrink-0 snap-start rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
                active
                  ? "bg-gradient-to-r from-afmc-maroon to-afmc-maroon/80 text-white ring-afmc-maroon/20 shadow-sm"
                  : "bg-white text-gray-700 ring-gray-200 hover:ring-afmc-maroon/25 hover:text-afmc-maroon"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-red-600" />
      {message}
    </div>
  );
}

function EmptyState({ title = "No items found", subtitle = "Try changing filters." }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white px-6 py-16 text-center">
      <div className="mb-4 flex justify-center">
        <Flame size={48} className="text-gray-300" />
      </div>
      <div className="text-xl font-bold text-gray-800">{title}</div>
      <div className="mt-2 text-sm text-gray-600">{subtitle}</div>
    </div>
  );
}

function FilterShell({ leftFilter, rightFilter, children }) {
  return (
    <div className="space-y-6">
      {(leftFilter || rightFilter) && (
        <div className="grid gap-4 md:grid-cols-2">
          {leftFilter && <div>{leftFilter}</div>}
          {rightFilter && <div>{rightFilter}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}) {
  const normalizedOptions = useMemo(
    () => Array.from(new Set(options.filter(Boolean))),
    [options]
  );

  return (
    <label className="block">
      <div className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-700">{label}</div>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/20 hover:border-afmc-maroon/40"
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnduserOtherSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/menubar`);
        const result = await response.json();
        if (!response.ok || result?.success === false) {
          throw new Error(result?.message || "Failed to fetch menu items");
        }
        setData(result.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  return (
    <FilterShell
      leftFilter={
        <SelectField
          label="Category"
          value=""
          onChange={() => {}}
          options={[]}
          placeholder="All Categories"
          disabled
        />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <InlineError message={error} />
      {loading ? (
        <MenuGridSkeleton count={15} />
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : (
        <ProgressiveMenuGrid items={visibleItems} onItemClick={onItemClick} />
      )}
    </FilterShell>
  );
}

function EnduserMocktailSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/fetchmocktail`);
        const result = await response.json();
        if (!response.ok || result?.success === false) {
          throw new Error(result?.message || "Failed to fetch mocktails");
        }
        setData(result.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  return (
    <FilterShell
      leftFilter={
        <div className="hidden md:block" />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <InlineError message={error} />
      {loading ? (
        <MenuGridSkeleton count={15} />
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : (
        <ProgressiveMenuGrid items={visibleItems} onItemClick={onItemClick} />
      )}
    </FilterShell>
  );
}

function DrinkHardDrinkSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("beer");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/Drinkhard${category}`
        );
        const result = await response.json();
        if (!response.ok || result?.success === false) {
          throw new Error(result?.message || "Failed to fetch hard drinks");
        }
        setData(result.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [category]);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  return (
    <div className="space-y-6 rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
      <InlineError message={error} />
      <div className="flex flex-wrap gap-3">
        {hardDrinkCategories.map((item) => (
          <CategoryButton
            key={item.value}
            active={category === item.value}
            label={item.label}
            onClick={() => {
              setCategory(item.value);
              setSelectedItem("");
            }}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="hidden md:block" />
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      </div>

      {loading ? (
        <MenuGridSkeleton count={15} />
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : (
        <ProgressiveMenuGrid items={visibleItems} showStockStatus onItemClick={onItemClick} />
      )}
    </div>
  );
}

function SnackVegSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/Snacksveg`);
        const result = await response.json();
        if (!response.ok || result?.success === false) {
          throw new Error(result?.message || "Failed to fetch veg snacks");
        }
        setData(result.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  return (
    <FilterShell
      leftFilter={
        <div className="hidden md:block" />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <InlineError message={error} />
      {loading ? (
        <MenuGridSkeleton count={15} />
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : (
        <ProgressiveMenuGrid items={visibleItems} onItemClick={onItemClick} />
      )}
    </FilterShell>
  );
}

function SnackNonVegSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/Snakcnonveg`);
        const result = await response.json();
        if (!response.ok || result?.success === false) {
          throw new Error(result?.message || "Failed to fetch non-veg snacks");
        }
        setData(result.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  return (
    <FilterShell
      leftFilter={
        <div className="hidden md:block" />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <InlineError message={error} />
      {loading ? (
        <MenuGridSkeleton count={15} />
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : (
        <ProgressiveMenuGrid items={visibleItems} showStockStatus onItemClick={onItemClick} />
      )}
    </FilterShell>
  );
}

function MenuDashboard() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("drinks");
  const [drinkSection, setDrinkSection] = useState("soft");
  const [snackSection, setSnackSection] = useState("veg");
  const [softDrinkCategory, setSoftDrinkCategory] = useState("Others");
  const [popupItem, setPopupItem] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupLoading, setPopupLoading] = useState(false);
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const handleItemClick = async (item) => {
    if (!item?.item_code || !item?.item_id) {
      return;
    }

    setPopupOpen(true);
    setPopupLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/memupopup?itemCode=${item.item_code}&itemId=${item.item_id}`
      );
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to fetch popup details");
      }

      setPopupItem(result.data);
    } catch (error) {
      console.error("Popup fetch error:", error);
      setPopupItem({
        ...item,
        description: item.description || "",
        unit_price: item.unit_price || 0,
        ac_unit: item.ac_unit || "Nos",
        quantity: item.quantity || 0,
      });
    } finally {
      setPopupLoading(false);
    }
  };

  const closePopup = () => {
    setPopupOpen(false);
    setPopupItem(null);
    setPopupLoading(false);
  };

  useEffect(() => {
    let alive = true;

    const loadOffers = async () => {
      setOffersLoading(true);
      try {
        const res = await offersAPI.getAllOffers();
        const list = res?.data?.offers ?? res?.data?.data ?? res?.data ?? [];
        if (!alive) return;
        setOffers(Array.isArray(list) ? list : []);
      } catch (error) {
        if (!alive) return;
        setOffers([]);
        console.error("Fetch offers error:", error);
      } finally {
        if (!alive) return;
        setOffersLoading(false);
      }
    };

    loadOffers();
    return () => {
      alive = false;
    };
  }, []);

  const handleShareOffer = async (offer) => {
    const text = formatOfferLine(offer);

    try {
      if (navigator?.share) {
        await navigator.share({ title: "AFMC Offer", text });
        return;
      }
    } catch (error) {
      console.error("Share error:", error);
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error("Clipboard error:", error);
    }
  };

  const currentSectionKey = mainTab === "drinks" ? drinkSection : snackSection;
  const currentSection = useMemo(
    () => menuConfig[mainTab].sections[currentSectionKey],
    [currentSectionKey, mainTab]
  );

  const renderedContent = useMemo(() => {
    if (mainTab === "drinks" && drinkSection === "soft") {
      return softDrinkCategory === "Mocktail" ? (
        <EnduserMocktailSection onItemClick={handleItemClick} />
      ) : (
        <EnduserOtherSection onItemClick={handleItemClick} />
      );
    }

    if (mainTab === "drinks" && drinkSection === "hard") {
      return <DrinkHardDrinkSection onItemClick={handleItemClick} />;
    }

    if (mainTab === "snacks" && snackSection === "veg") {
      return <SnackVegSection onItemClick={handleItemClick} />;
    }

    return <SnackNonVegSection onItemClick={handleItemClick} />;
  }, [drinkSection, mainTab, snackSection, softDrinkCategory]);

  const handleMainTabChange = (tabKey) => {
    setMainTab(tabKey);

    if (tabKey === "drinks") {
      setDrinkSection("soft");
      setSoftDrinkCategory("Others");
      return;
    }

    setSnackSection("veg");
  };

  const handleDrinkSectionChange = (sectionKey) => {
    setDrinkSection(sectionKey);

    if (sectionKey === "soft") {
      setSoftDrinkCategory("Others");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {/* Note: Layout already provides a sticky navbar; keep this header non-sticky to avoid overlap. */}
      <MenuHeader onBack={() => navigate(-1)} />

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <OffersScroller offers={offers} loading={offersLoading} onShare={handleShareOffer} />

        {/* Tabs - Horizontal Scroll */}
        <ScrollTabs
          items={Object.entries(menuConfig).map(([key, tab]) => ({ key, label: tab.label }))}
          activeKey={mainTab}
          onChange={handleMainTabChange}
        />

        {/* Section Tabs */}
        <ScrollTabs
          items={Object.entries(menuConfig[mainTab].sections).map(([key, section]) => ({ key, label: section.label }))}
          activeKey={currentSectionKey}
          onChange={(sectionKey) =>
            mainTab === "drinks" ? handleDrinkSectionChange(sectionKey) : setSnackSection(sectionKey)
          }
        />

        {/* Category Filters */}
        {currentSection.categories.length > 0 && (
          <ScrollTabs
            items={currentSection.categories.map((c) => ({ key: c.key, label: c.label }))}
            activeKey={softDrinkCategory}
            onChange={setSoftDrinkCategory}
          />
        )}

        {/* Content Area */}
        <div>
          {renderedContent}
        </div>
      </div>

      {/* Popup */}
      {popupOpen && (
        <MenuPopup item={popupItem} loading={popupLoading} onClose={closePopup} />
      )}
    </div>
  );
}

export default MenuDashboard;
