import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { ChevronsLeft, Flame, Coffee, Utensils } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, authFetchJson, cartAPI, offersAPI, barOrdersAPI } from "../../services/api";
import Pubmenubuyservice from "../../flows/buy/services/Pubmenubuyservice";
import FilterDropdown from "./FilterDropdown";
import OffersMarquee from "./OffersMarquee";
import { toInitCap } from "../../utils/textFormat";
import { getPegTypeOrderLimitMessage } from "../../utils/stockValidation";
import {
  clearSelectedAttendantCustomer,
  getSelectedAttendantCustomerPayload,
} from "../../utils/attendantCustomer";

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
      {toInitCap(label)}
    </button>
  );
}

function getStockQuantity(item) {
  const rawValue =
    item?.availableQuantity ??
    item?.available_quantity ??
    item?.stockQuantity ??
    item?.stock_quantity ??
    item?.STOCK_QUANTITY ??
    item?.quantity ??
    item?.QUANTITY;
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatPrice(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return "0.00";
  }

  return numericValue.toFixed(2);
}

function isOutOfStock(item) {
  const status = String(item?.stockStatus ?? item?.stock_status ?? "").trim().toLowerCase();
  if (status === "out of stock") return true;

  const stockQuantity = getStockQuantity(item);
  if (stockQuantity !== null) return stockQuantity <= 0;
  return false;
}

function isCocktailOrMocktailItem(item) {
  const subCategory = Number(item?.sub_category ?? item?.subcategory);
  if (![14, 15].includes(subCategory)) return false;

  const categoryId = Number(item?.category_id ?? item?.categoryId);
  return !Number.isFinite(categoryId) || categoryId === 10;
}

function getMenuItemCode(item) {
  const itemCode = Number(item?.item_code ?? item?.itemCode ?? item?.ITEM_CODE ?? item?.item_id);
  return Number.isFinite(itemCode) && itemCode > 0 ? itemCode : null;
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
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl max-h-[calc(100svh-2rem)] sm:max-h-[calc(100svh-3rem)]">
        <div className="sticky top-0 z-20 flex items-center justify-end border-b border-gray-100 bg-white/95 p-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-all hover:bg-red-100 hover:text-red-600"
            aria-label="Close popup"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse overflow-y-auto">
            <div className="h-64 w-full bg-gray-200" />
            <div className="p-6 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 sm:px-6 sm:pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-start">
              {/* Image */}
              <div className="flex justify-center sm:justify-start">
                <div className="h-28 w-28 sm:h-40 sm:w-40 rounded-2xl bg-gray-100 overflow-hidden flex items-center justify-center ring-1 ring-black/5">
                  <img
                    src={`${BASEAPI}${item?.image || "default.jpg"}`}
                    alt={item?.item_name || "Item"}
                    className="h-full w-full object-contain p-3 sm:p-4"
                  />
                </div>
              </div>

              {/* Title + meta */}
              <div className="min-w-0">
                <div className="flex flex-col gap-2 sm:gap-2.5">
                  <div className="text-center sm:text-left">
                    <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight break-words">
                      {toInitCap(item?.item_name) || "-"}
                    </h2>
                    {!isCocktailOrMocktailItem(item) && item.stock_status ? (
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                          {toInitCap(item.stock_status)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                     
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Unit</div>
                      <div className="text-sm font-bold text-gray-900">
                        {toInitCap(item?.ac_unit) || "Nos"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700">Quantity</label>
                <div className="flex items-center overflow-hidden rounded-xl border border-gray-300 bg-white">
                  <button
                    type="button"
                    onClick={() => setQty(String(Math.max(1, Number(qty) - 1)))}
                    className="h-11 w-12 font-extrabold text-gray-700 transition hover:bg-gray-50"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="h-11 w-full min-w-0 border-l border-r border-gray-300 text-center text-base font-extrabold text-gray-900 outline-none"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(String(Number(qty) + 1))}
                    className="h-11 w-12 font-extrabold text-gray-700 transition hover:bg-gray-50"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700">Type</label>
                <select
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm font-bold text-gray-800 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/20"
                >
                  <option value="Din">{toInitCap("Dine In")}</option>
                  <option value="Take Away">{toInitCap("Take Away")}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {!loading ? (
          <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
            <div className="space-y-2">
              <button
                type="button"
                className="w-full rounded-lg bg-afmc-maroon px-4 py-3 font-bold text-white transition-all hover:bg-afmc-maroon/90 active:scale-[0.99]"
              >
                {toInitCap("Add to cart")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                {toInitCap("Cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MenuGrid({ items, showStockStatus = false, ignoreStockStatus = false, onItemClick }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-5 xl:grid-cols-5">
      {items.map((item, index) => {
        const shouldIgnoreStock = ignoreStockStatus || isCocktailOrMocktailItem(item);
        const outOfStock = !shouldIgnoreStock && isOutOfStock(item);
        const stockDisabled = outOfStock;
        const stockStatus = outOfStock ? "Out Of Stock" : item.stock_status;

        return (
          <button
            type="button"
            onClick={() => {
              if (stockDisabled) return;
              onItemClick?.(item);
            }}
            disabled={stockDisabled}
            key={item.item_id || item.item_code || `${item.item_name}-${index}`}
            className={`group relative overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-afmc-maroon ${
              stockDisabled
                ? "cursor-not-allowed opacity-75"
                : "hover:-translate-y-0.5 hover:border-afmc-maroon/30 hover:shadow-[0_14px_30px_rgba(15,23,42,0.11)]"
            }`}
          >
            {/* Image Container */}
            <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-gray-50 via-white to-[#f7f0e5]">
              <div className="absolute inset-x-5 bottom-3 h-7 rounded-full bg-afmc-gold/10 blur-xl" aria-hidden="true" />
              <img
                src={`${BASEAPI}${item.image || "default.jpg"}`}
                alt={item.item_name}
                className={`relative h-full w-full object-contain p-3.5 transition-transform duration-300 ${
                  stockDisabled ? "blur-[2px] grayscale opacity-60" : "group-hover:scale-105"
                }`}
              />

              {/* Stock Status Badge */}
              {!shouldIgnoreStock && (outOfStock || (showStockStatus && item.stock_status)) && (
                <div className="absolute left-2 top-2 rounded-md bg-red-600 text-white px-2 py-1 text-xs font-bold shadow">
                  {toInitCap(stockStatus)}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="space-y-2 p-3">
              <div className="line-clamp-2 text-[13px] font-extrabold leading-tight text-gray-900 sm:text-sm">
                {toInitCap(item.item_name)}
                {/* <p> {item.stock_status} </p> */}
              </div>

              {/* {outOfStock ? (
                <div className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
                  {toInitCap("Out Of Stock")}
                </div>
              ) : null} */}

              <div className="h-0.5 rounded-full bg-gradient-to-r from-afmc-maroon/70 via-afmc-gold/70 to-transparent" />

              {/* CTA Button */}
              {/* <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (outOfStock) return;
                  onItemClick?.(item);
                }}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-afmc-maroon text-white text-xs font-bold transition-all duration-300 hover:bg-afmc-maroon/90 active:scale-95"
              >
                Add to Cart
              </button> */}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MenuPopupCompact({ item, loading, onClose, onBuy }) {
  const { user, setCartCount } = useAuth();
  const [qty, setQty] = useState("1");
  const [remarks, setRemarks] = useState("Din");
  const [pegType, setPegType] = useState("Small");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userId = user?.userId;
  const isMocktailItem = isCocktailOrMocktailItem(item);
  const acUnit = item?.ac_unit || item?.["A/C_UNIT"] || "Nos";
  const isPegsUnit = String(acUnit).trim().toLowerCase() === "pegs";

  const fetchCartCount = async () => {
    if (!userId) return;
    try {
      const response = await cartAPI.getByUserId(userId);
      const items = response?.data?.data || [];
      setCartCount?.(items.length);
    } catch (err) {
      console.error("Error fetching cart count:", err);
    }
  };

  const getPegMultiplier = (type) => {
    return String(type || "").trim().toLowerCase() === "large" ? 2 : 1;
  };

  const handleAddToCart = async () => {
    if (!item) return;

    if (isPegsUnit && !pegType) {
      toast.error("Select the type");
      return;
    }

    const pegMultiplier = getPegMultiplier(pegType);

    try {
      setIsSubmitting(true);
      const menuSearchParams = new URLSearchParams(window.location.search);
      const selectedPubmed = String(
        window.history.state?.usr?.pubmed ||
        menuSearchParams.get("pubmed") ||
        window.history.state?.usr?.pubmedName ||
        menuSearchParams.get("pubmedName") ||
        sessionStorage.getItem("afmc:selectedPubmed") ||
        ""
      ).trim() || null;
      const selectedPubmedName = String(
        window.history.state?.usr?.pubmedName ||
        menuSearchParams.get("pubmedName") ||
        window.history.state?.usr?.pubmed ||
        menuSearchParams.get("pubmed") ||
        sessionStorage.getItem("afmc:selectedPubmedName") ||
        ""
      ).trim() || null;

      if (selectedPubmed) {
        sessionStorage.setItem("afmc:selectedPubmed", selectedPubmed);
      }
      if (selectedPubmedName) {
        sessionStorage.setItem("afmc:selectedPubmedName", selectedPubmedName);
      }
      const cartData = {
        // Server cart module expects inventory ITEM_CODE in `item_id`.
        // Menu popup also has `item_id` (inventory ITEM_ID), which would break stock lookup.
        item_id: item?.item_code ?? item?.item_id,
        item_name: item?.item_name,
        quantity: parseInt(qty, 10) || 1,
        unit_price: item?.unit_price,
        remarks,
        type: isPegsUnit ? pegType : null,
      };

      // console.log("Adding to cart with data:", cartData);

      // Reservation/stock checks before adding to cart
      try {
        const desiredQty = Number(cartData.quantity || 1) || 1;
        const itemCode = Number(item?.item_code ?? item?.item_id) || null;

        if (isMocktailItem && Number.isFinite(itemCode) && itemCode > 0) {
          // For cocktails/mocktails, validate ingredient stocks
          try {
            const res = await barOrdersAPI.getCocktailDetailsById(itemCode);
            const details = res?.data?.data?.details || [];
            const ingredients = (details || [])
              .map((d) => ({
                itemCode: Number(d?.ITEM_CODE ?? d?.itemCode),
                pegs: Number(d?.PEGS ?? d?.pegs ?? d?.QUANTITY ?? d?.quantity ?? 0) || 0,
                itemName: String(d?.ITEM_NAME ?? d?.itemName ?? "").trim(),
              }))
              .filter((x) => Number.isFinite(x.itemCode) && x.itemCode > 0 && x.pegs > 0);

            if (ingredients.length > 0) {
              const codes = [...new Set(ingredients.map((ing) => ing.itemCode))];
              const stockRes = await cartAPI.getIngredientStocks(codes, undefined, undefined, undefined, true);
              const stockMap = stockRes?.data?.data || {};

              for (const ing of ingredients) {
                const rawAvailable = stockMap?.[String(ing.itemCode)];
                if (rawAvailable === undefined || rawAvailable === null || rawAvailable === "") continue;
                const available = Number(rawAvailable);
                if (!Number.isFinite(available) || available < 0) continue;
                const required = ing.pegs * desiredQty * pegMultiplier;
                if (required > available) {
                  const msg = `Out of stock for ingredient ${ing.itemName || ing.itemCode}. Available quantity: ${available}`;
                  toast.error(msg);
                  setIsSubmitting(false);
                  return;
                }
              }
            }
          } catch (err) {
            // ignore ingredient check failures — do not hard-block
          }
        } else if (Number.isFinite(itemCode) && itemCode > 0) {
          // For regular items, check available quantity (reservation-aware via API)
          try {
            const stockRes = await cartAPI.getIngredientStocks([itemCode], undefined, undefined, undefined, true);
            const stockMap = stockRes?.data?.data || {};
            const rawAvailable = stockMap?.[String(itemCode)];
            if (rawAvailable !== undefined && rawAvailable !== null && rawAvailable !== "") {
              const available = Number(rawAvailable);
              if (Number.isFinite(available) && available >= 0 && desiredQty * pegMultiplier > available) {
                toast.error(getPegTypeOrderLimitMessage(item, available, `Out of stock. Available quantity: ${available}`, pegType));
                setIsSubmitting(false);
                return;
              }
            }
          } catch (err) {
            // ignore stock check failure
          }
        }
      } catch (err) {
        // ignore reservation check errors
      }

      const response = await cartAPI.addItem(cartData);
      toast.success("Item added to cart!");
      if (response?.status === 201) {
        await fetchCartCount();
      }
      setTimeout(() => onClose?.(), 1200);
    } catch (err) {
      console.error("Error adding to cart:", err);
      const errorMessage =
        err?.response?.data?.message || err?.message || "Failed to add item to cart";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyNow = () => {
    const trimmedRemarks = String(remarks || "").trim();
    const quantityValue = Number(qty);

    if (isPegsUnit && !pegType) {
      toast.error("Select the type");
      return;
    }

    if (!trimmedRemarks) {
      toast.error("Remarks is required");
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      toast.error("Valid quantity is required");
      return;
    }

    if (!Number.isInteger(quantityValue)) {
      toast.error("Quantity is not in decimals");
      return;
    }

    if (isMocktailItem && quantityValue > 5) {
      toast.error("Quantity must be 5 or less");
      return;
    }

    onBuy?.(item, quantityValue, trimmedRemarks, isPegsUnit ? pegType || null : null);
  };

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

  useEffect(() => {
    setPegType(isPegsUnit ? "Small" : "");
  }, [item?.item_id, item?.item_code, isPegsUnit]);

  if (!item && !loading) {
    return null;
  }

  const imageSrc = `${BASEAPI}${item?.image || "default.jpg"}`;
  const itemName = toInitCap(item?.item_name) || "-";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[18px] border border-stone-200 bg-white shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-end border-b border-stone-200 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close popup"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[140px_minmax(0,1fr)]">
              <div className="h-28 rounded bg-gray-200" />
              <div className="space-y-3">
                <div className="h-5 w-2/3 rounded bg-gray-200" />
                <div className="h-16 w-full rounded bg-gray-100" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="h-12 rounded bg-gray-100" />
                  <div className="h-12 rounded bg-gray-100" />
                  <div className="h-12 rounded bg-gray-100" />
                </div>
                <div className="flex gap-3">
                  <div className="h-11 w-36 rounded-full bg-gray-200" />
                  <div className="h-11 w-24 rounded-full bg-gray-100" />
                  <div className="h-11 w-28 rounded-full bg-gray-100" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-[140px_minmax(0,1fr)] md:items-start">
              <div className="flex items-start justify-center md:justify-start">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded bg-white">
                  <img
                    src={imageSrc}
                    alt={item?.item_name || "Item"}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-5">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px] md:items-start">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold leading-5 text-stone-600">
                          {toInitCap("Item Name")}
                        </div>
                        <h2 className="mt-1 text-[18px] font-bold leading-6 text-stone-900 break-words">
                          {itemName}
                        </h2>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[14px] font-semibold leading-5 text-stone-600">
                          {toInitCap("Price")}
                        </div>
                        <div className="mt-1 text-[18px] font-extrabold leading-6 text-afmc-maroon">
                          ₹{formatPrice(item?.unit_price)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                    <div className="text-[14px] font-semibold leading-5 text-stone-600">
                      {toInitCap("A/C Unit")}
                    </div>
                    <div>
                      <div className="h-11 w-full rounded border border-stone-300 bg-white px-3 text-[15px] font-medium text-stone-700">
                        <span className="flex h-full items-center">{toInitCap(acUnit) || "Nos"}</span>
                      </div>
                    </div>

                    <div className="text-[14px] font-semibold leading-5 text-stone-600">
                      {toInitCap("Quantity")}
                    </div>
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) =>
                          Number(e.target.value) <= 999 && setQty(e.target.value)
                        }
                        className="h-11 w-full rounded border border-stone-300 bg-white px-3 text-[15px] font-medium text-stone-900 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/20"
                        inputMode="numeric"
                      />
                    </div>

                    {isPegsUnit ? (
                      <>
                        <div className="text-[14px] font-semibold leading-5 text-stone-600">
                          {toInitCap("Type")}
                        </div>
                        <div>
                          <select
                            value={pegType}
                            onChange={(e) => setPegType(e.target.value)}
                            className="h-11 w-full rounded border border-stone-300 bg-white px-3 text-[15px] font-medium text-stone-800 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/20"
                          >
                            <option value="Small">{toInitCap("Small")}</option>
                            <option value="Large">{toInitCap("Large")}</option>
                          </select>
                        </div>
                      </>
                    ) : null}

                    <div className="text-[14px] font-semibold leading-5 text-stone-600">
                      {toInitCap("Remarks")}
                    </div>
                    <div>
                      <select
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="h-11 w-full rounded border border-stone-300 bg-white px-3 text-[15px] font-medium text-stone-800 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/20"
                      >
                        <option value="Din">{toInitCap("Dine In")}</option>
                        <option value="Take Away">{toInitCap("Take Away")}</option>
                      </select>
                    </div>
                  </div>
                  </div>

                  <div className="grid grid-cols-[auto_auto] items-start justify-start gap-x-4 gap-y-1 md:justify-end">
                    {!isMocktailItem && item?.stock_status ? (
                      <>
                        <div className="text-[14px] font-semibold leading-5 text-stone-600">
                          {toInitCap("Status")}
                        </div>
                        <div className="text-[14px] font-medium text-red-600">
                          {toInitCap(item.stock_status)}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 md:pl-[calc(4rem+140px)]">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isSubmitting}
                    className="min-w-[170px] rounded-full bg-afmc-maroon px-8 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-afmc-gold/25 transition hover:bg-afmc-maroon/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? toInitCap("Adding...") : toInitCap("Add to cart")}
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="min-w-[90px] rounded-full bg-white px-8 py-3 text-sm font-semibold text-afmc-maroon shadow-sm ring-1 ring-afmc-gold/35 transition hover:bg-afmc-gold/5"
                  >
                    {toInitCap("Buy")}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-w-[130px] rounded-full bg-white px-8 py-3 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-300 transition hover:bg-stone-50"
                  >
                    {toInitCap("Cancel")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
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
  ignoreStockStatus = false,
  onItemClick,
  initialCount = 20,
  step = 20,
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [availabilityByCode, setAvailabilityByCode] = useState({});
  const sentinelRef = React.useRef(null);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items, initialCount]);

  const hasMore = visibleCount < items.length;
  const slice = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  useEffect(() => {
    let alive = true;

    const loadAvailability = async () => {
      if (ignoreStockStatus || slice.length === 0) {
        if (alive) setAvailabilityByCode({});
        return;
      }

      const codes = [
        ...new Set(
          slice
            .filter((item) => !isCocktailOrMocktailItem(item))
            .map((item) => getMenuItemCode(item))
            .filter((code) => Number.isFinite(code) && code > 0)
        ),
      ];

      if (codes.length === 0) {
        if (alive) setAvailabilityByCode({});
        return;
      }

      try {
        // Dashboard tiles should reflect true remaining physical stock, not
        // stock minus what this same user already put in their own cart.
        // Otherwise, adding the last N units to the cart makes the tile show
        // "Out of Stock" even though those units are still buyable by this
        // same user via the buy flow. excludeCartId/orderNumber are left
        // unset here on purpose; ignoreOwnCart=true skips the own-cart
        // subtraction entirely on the backend.
        const response = await cartAPI.getIngredientStocks(codes, undefined, undefined, undefined, true);
        const stockMap = response?.data?.data || {};
        if (!alive) return;
        setAvailabilityByCode((current) => {
          const next = { ...current };
          codes.forEach((code) => {
            const rawValue = stockMap?.[String(code)];
            const available = Number(rawValue);
            if (Number.isFinite(available) && available >= 0) {
              next[String(code)] = available;
            }
          });
          return next;
        });
      } catch (error) {
        if (!alive) return;
        console.error("Menu stock availability fetch error:", error);
      }
    };

    loadAvailability();
    return () => {
      alive = false;
    };
  }, [ignoreStockStatus, slice]);

  const stockAwareItems = useMemo(() => {
    if (ignoreStockStatus) return slice;

    return slice.map((item) => {
      if (isCocktailOrMocktailItem(item)) return item;
      const itemCode = getMenuItemCode(item);
      const availableQuantity = itemCode ? availabilityByCode[String(itemCode)] : undefined;
      if (availableQuantity === undefined) return item;

      return {
        ...item,
        availableQuantity,
        stockQuantity: availableQuantity,
        stock_status: item.stock_status,
      };
    });
  }, [availabilityByCode, ignoreStockStatus, slice]);

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
      <MenuGrid
        items={stockAwareItems}
        showStockStatus={showStockStatus}
        ignoreStockStatus={ignoreStockStatus}
        onItemClick={onItemClick}
      />
      {hasMore ? <BottomLoader /> : null}
      <div ref={sentinelRef} />
    </div>
  );
}

function MenuHeader({ onBack }) {
  return (
    <div className="border-b border-afmc-maroon/10 bg-gradient-to-r from-[#fffdf8] via-white to-[#f7efe6] shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-afmc-maroon text-white shadow-lg shadow-afmc-maroon/20" aria-hidden="true">
                <Utensils className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">Menu</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-afmc-maroon/70">Add items to cart</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-bold text-gray-700 shadow-sm transition-all hover:border-afmc-maroon/25 hover:bg-white hover:text-afmc-maroon hover:shadow"
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
  const few = Array.isArray(items) && items.length <= 2;

  return (
    <div className="w-full">
      {few ? (
        items.length === 1 ? (
          <div className="grid grid-cols-1 gap-2">
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => onChange(it.key)}
                className={`w-full rounded-full px-4 py-2 text-sm font-bold transition text-gray-700 hover:bg-white hover:text-afmc-maroon`}
                aria-current={activeKey === it.key ? "page" : undefined}
              >
                <span className="whitespace-nowrap">{it.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="inline-grid grid-cols-2 rounded-full bg-white/80 p-1.5 shadow-sm ring-1 ring-gray-200">
            {items.map((it) => {
              const active = activeKey === it.key;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => onChange(it.key)}
                  className={`w-full rounded-full px-5 py-2 text-sm font-extrabold transition ${
                    active
                      ? "bg-gray-950 text-white shadow-sm"
                      : "bg-transparent text-gray-700 hover:bg-gray-50 hover:text-afmc-maroon"
                  }`}
                  aria-pressed={active}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        )
      ) : (
        <div className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-full bg-white/70 p-1 shadow-inner ring-1 ring-gray-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((it) => {
            const active = activeKey === it.key;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onChange(it.key)}
                className={`shrink-0 snap-start rounded-full px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-gradient-to-r from-afmc-maroon to-afmc-maroon/80 text-white shadow-sm"
                    : "text-gray-700 hover:bg-white hover:text-afmc-maroon"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="whitespace-nowrap">{it.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MainTabsBar({ activeKey, onChange }) {
  const items = [
    { key: "drinks", label: "Drinks", Icon: Coffee },
    { key: "snacks", label: "Snacks", Icon: Utensils },
  ];

  return (
    <div className="w-full overflow-hidden rounded-[1.35rem] border border-white bg-white/80 p-1 shadow-[0_12px_35px_rgba(15,23,42,0.08)] ring-1 ring-gray-200/70">
      <div className="grid grid-cols-2 gap-1">
        {items.map(({ key, label, Icon }) => {
          const active = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`relative flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                active
                  ? "bg-gradient-to-r from-afmc-maroon to-[#8f1234] text-white shadow-lg shadow-afmc-maroon/20"
                  : "text-gray-600 hover:bg-gray-50 hover:text-afmc-maroon"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`h-4 w-4 ${active ? "text-white" : "text-gray-500"}`} />
              {label}
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-afmc-gold"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SubTabsPills({ items, activeKey, onChange }) {
  return (
    <div className="w-full">
      <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/80 p-1.5 shadow-sm ring-1 ring-gray-200">
        {items.map((it) => {
          const active = activeKey === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onChange(it.key)}
              className={`rounded-full px-5 py-2 text-sm font-extrabold transition ${
                active
                  ? "bg-gray-950 text-white shadow-sm"
                  : "bg-transparent text-gray-700 hover:bg-gray-50 hover:text-afmc-maroon"
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
  const hasBoth = Boolean(leftFilter && rightFilter);

  return (
    <div className="space-y-6">
      {(leftFilter || rightFilter) && (
        <div className={`grid gap-4 ${hasBoth ? "grid-cols-2" : "grid-cols-1"}`}>
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
    () => Array.from(new Set((options || []).filter(Boolean))),
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
        {normalizedOptions.map((option) => {
          const value = option?.value ?? option?.id ?? option;
          const label = option?.label ?? option?.name ?? String(value);
          return (
            <option key={String(value)} value={String(value)}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function EnduserOtherSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await authFetchJson(`${API_BASE_URL}/menubar`);
        // console.log("Fetched menu data:", result.data);
        setData(result?.data || []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    let list = data;

    if (selectedCategory) {
      const categoryId = Number(selectedCategory);
      list = list.filter((item) => Number(item?.sub_category) === categoryId);
    }

    if (!selectedItem) {
      return list;
    }

    return list.filter((item) => item.item_name === selectedItem);
  }, [data, selectedCategory, selectedItem]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    (Array.isArray(data) ? data : []).forEach((item) => {
      const id = item?.sub_category;  
      const name = item?.sub_category_name;
      if (id === null || id === undefined || id === "") return;
      if (!map.has(String(id))) {
        map.set(String(id), { value: String(id), label: name ? String(name) : String(id) });
      }
    });
    // console.log("Computed category options:", Array.from(map.values()));
    return Array.from(map.values());
  }, [data]);

  const itemOptions = useMemo(() => {
    return visibleItems.map((item) => item.item_name);
  }, [visibleItems]);

  return (
    <FilterShell
      leftFilter={
        <FilterDropdown
          label="Category"
          value={selectedCategory}
          onChange={(next) => {
            setSelectedCategory(next);
            setSelectedItem("");
          }}
          options={categoryOptions}
          placeholder="All Categories"
          allLabel="All Categories"
        />
      }
      rightFilter={
        <FilterDropdown
          label="Item Name"
          value={selectedItem}
          onChange={(next) => setSelectedItem(next)}
          options={itemOptions}
          placeholder="Select Item"
          allLabel="All Items"
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
        const result = await authFetchJson(`${API_BASE_URL}/fetchmocktail`);
        setData(result?.data || []);
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
        <FilterDropdown
          label="Item Name"
          value={selectedItem}
          onChange={(next) => setSelectedItem(next)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
          allLabel="All Items"
        />
      }
    >
      <InlineError message={error} />
      {loading ? (
        <MenuGridSkeleton count={15} />
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : (
        <ProgressiveMenuGrid items={visibleItems} ignoreStockStatus onItemClick={onItemClick} />
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
        const result = await authFetchJson(`${API_BASE_URL}/Drinkhard${category}`);
        setData(result?.data || []);
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
        <FilterDropdown
          label="Item Name"
          value={selectedItem}
          onChange={(next) => setSelectedItem(next)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
          allLabel="All Items"
        />
      </div>

      {loading ? (
        <MenuGridSkeleton count={15} />
      ) : visibleItems.length === 0 ? (
        <EmptyState />
      ) : (
        <ProgressiveMenuGrid
          items={visibleItems}
          showStockStatus
          ignoreStockStatus={category === "cocktail"}
          onItemClick={onItemClick}
        />
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
        const result = await authFetchJson(`${API_BASE_URL}/Snacksveg`);
        setData(result?.data || []);
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
        <FilterDropdown
          label="Item Name"
          value={selectedItem}
          onChange={(next) => setSelectedItem(next)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
          allLabel="All Items"
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
        const result = await authFetchJson(`${API_BASE_URL}/Snakcnonveg`);
        setData(result?.data || []);
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
        <FilterDropdown
          label="Item Name"
          value={selectedItem}
          onChange={(next) => setSelectedItem(next)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
          allLabel="All Items"
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
  const { user, setCartCount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mainTab, setMainTab] = useState("drinks");
  const [drinkSection, setDrinkSection] = useState("soft");
  const [snackSection, setSnackSection] = useState("veg");
  const [softDrinkCategory, setSoftDrinkCategory] = useState("Others");
  const [popupItem, setPopupItem] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupLoading, setPopupLoading] = useState(false);
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);

  useEffect(() => {
    // Prevent stale invoice/order pages from reappearing via browser Back after returning to menu.
    try {
      const trap = sessionStorage.getItem("afmc:historyTrap:menudash");
      if (trap === "1") {
        sessionStorage.removeItem("afmc:historyTrap:menudash");
        window.history.pushState({ afmcTrap: true }, "", window.location.href);
      }
    } catch (_) {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Refresh cart count when the menu dashboard mounts so badge state stays in sync.
    const fetchCartCount = async () => {
      if (!user?.userId || typeof setCartCount !== "function") return;
      try {
        const response = await cartAPI.getByUserId(user.userId);
        const items = response?.data?.data || [];
        setCartCount(items.length);
      } catch (err) {
        console.error("Error refreshing cart count on menu dashboard:", err);
      }
    };

    fetchCartCount();
  }, [user?.userId, setCartCount]);

  useEffect(() => {
    // If user presses browser Back immediately after landing on menu from invoice-like pages,
    // keep them on menu instead of going back to the stale invoice route.
    const onPopState = () => {
      try {
        const guard = sessionStorage.getItem("afmc:guardBack:menudash");
        if (guard === "1") {
          // stay on menu; add an entry back so the URL doesn't change.
          window.history.pushState({ afmcGuard: true }, "", window.location.href);
          sessionStorage.removeItem("afmc:guardBack:menudash");
        }
      } catch (_) {
        // ignore
      }
    };

    try {
      window.addEventListener("popstate", onPopState);
    } catch (_) {
      // ignore
    }

    return () => {
      try {
        window.removeEventListener("popstate", onPopState);
      } catch (_) {
        // ignore
      }
    };
  }, []);

  const handleBuy = async (item, qty, remarks, selectedType) => {
    try {
      const typeForBackend = selectedType || null;
      const pegMultiplier = String(typeForBackend || "").trim().toLowerCase() === "large" ? 2 : 1;
      const desiredQty = Number(qty) || 1;
      const itemCode = Number(item?.item_code ?? item?.item_id) || null;

      try {
        if (isCocktailOrMocktailItem(item) && Number.isFinite(itemCode) && itemCode > 0) {
          const res = await barOrdersAPI.getCocktailDetailsById(itemCode);
          const details = res?.data?.data?.details || [];
          const ingredients = (details || [])
            .map((d) => ({
              itemCode: Number(d?.ITEM_CODE ?? d?.itemCode),
              pegs: Number(d?.PEGS ?? d?.pegs ?? d?.QUANTITY ?? d?.quantity ?? 0) || 0,
              itemName: String(d?.ITEM_NAME ?? d?.itemName ?? "").trim(),
            }))
            .filter((x) => Number.isFinite(x.itemCode) && x.itemCode > 0 && x.pegs > 0);

          if (ingredients.length > 0) {
            const codes = [...new Set(ingredients.map((ing) => ing.itemCode))];
            const stockRes = await cartAPI.getIngredientStocks(codes, undefined, undefined, undefined, true);
            const stockMap = stockRes?.data?.data || {};

            for (const ing of ingredients) {
              const rawAvailable = stockMap?.[String(ing.itemCode)];
              if (rawAvailable === undefined || rawAvailable === null || rawAvailable === "") continue;
              const available = Number(rawAvailable);
              if (!Number.isFinite(available) || available < 0) continue;
              const required = ing.pegs * desiredQty * pegMultiplier;
              if (required > available) {
                toast.error(`Out of stock for ingredient ${ing.itemName || ing.itemCode}. Available quantity: ${available}`);
                return;
              }
            }
          }
        } else if (Number.isFinite(itemCode) && itemCode > 0) {
          const stockRes = await cartAPI.getIngredientStocks([itemCode], undefined, undefined, undefined, true);
          const stockMap = stockRes?.data?.data || {};
          const rawAvailable = stockMap?.[String(itemCode)];
          if (rawAvailable !== undefined && rawAvailable !== null && rawAvailable !== "") {
            const available = Number(rawAvailable);
            if (Number.isFinite(available) && available >= 0 && desiredQty * pegMultiplier > available) {
              toast.error(getPegTypeOrderLimitMessage(item, available, `Out of stock. Available quantity: ${available}`, typeForBackend));
              return;
            }
          }
        }
      } catch (err) {
        // ignore stock check failures here; do not hard-block buy flow on API issues
      }

      const menuSearchParams = new URLSearchParams(location.search);
      const selectedPubmed = String(
        location.state?.pubmed ||
        menuSearchParams.get("pubmed") ||
        location.state?.pubmedName ||
        menuSearchParams.get("pubmedName") ||
        sessionStorage.getItem("afmc:selectedPubmed") ||
        ""
      ).trim() || null;
      const selectedPubmedName = String(
        location.state?.pubmedName ||
        menuSearchParams.get("pubmedName") ||
        location.state?.pubmed ||
        menuSearchParams.get("pubmed") ||
        sessionStorage.getItem("afmc:selectedPubmedName") ||
        ""
      ).trim() || null;

      if (selectedPubmed) {
        sessionStorage.setItem("afmc:selectedPubmed", selectedPubmed);
      }
      if (selectedPubmedName) {
        sessionStorage.setItem("afmc:selectedPubmedName", selectedPubmedName);
      }

      const response = await Pubmenubuyservice.createOrder({
        itemCode: item?.item_code,
        itemId: item?.item_id,
        quantity: Number(qty) || 1,
        remarks,
        categoryId: item?.category_id,
        type: typeForBackend,
        unitPrice: item?.unit_price,
        profit: item?.profit,
        prCharges: item?.pr_charges,
        userId: item?.user_id,
        subCategory: item?.sub_category,
        barcode: item?.barcode,
        pubmed: selectedPubmed,
        ...(location.pathname.startsWith("/attendant") ? getSelectedAttendantCustomerPayload() : {}),
      });

      const orderNumber = response?.data?.data?.orderNumber;
      if (!orderNumber) {
        throw new Error("Order number was not returned");
      }

      const baseSegment = location.pathname.startsWith("/user") ? "/user" : "/attendant";
      if (baseSegment === "/attendant") {
        clearSelectedAttendantCustomer();
      }
      navigate(`${baseSegment}/menudash/buy?orderNumber=${orderNumber}`, {
        state: { orderNumber },
      });
      closePopup();
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || "Unable to create order.";
      try {
        toast.error(msg);
      } catch {
        // fallback to console if toast isn't available
        console.error(msg);
      }
    }
  };

  const baseSegment = location.pathname.startsWith("/user")
    ? "/user"
    : location.pathname.startsWith("/attendant")
      ? "/attendant"
      : "/user";

  const handleItemClick = async (item) => {
    if (isOutOfStock(item) && !isCocktailOrMocktailItem(item)) {
      return;
    }

    if (!item?.item_code || !item?.item_id) {
      return;
    }

    setPopupItem({
      ...item,
      description: item.description || "",
      unit_price: item.unit_price || 0,
      ac_unit: item.ac_unit || "Nos",
      quantity: item.quantity || 0,
    });
    setPopupOpen(true);
    setPopupLoading(true);

    try {
      const result = await authFetchJson(
        `${API_BASE_URL}/memupopup?itemCode=${item.item_code}&itemId=${item.item_id}`
      );

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
      <MenuHeader onBack={() => navigate(`${baseSegment}/dashboard`, { replace: true })} />

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <OffersMarquee offers={offers} loading={offersLoading} />

        {/* Tabs */}
        <div className="space-y-4">
          <MainTabsBar activeKey={mainTab} onChange={handleMainTabChange} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SubTabsPills
              items={Object.entries(menuConfig[mainTab].sections).map(([key, section]) => ({ key, label: section.label }))}
              activeKey={currentSectionKey}
              onChange={(sectionKey) =>
                mainTab === "drinks" ? handleDrinkSectionChange(sectionKey) : setSnackSection(sectionKey)
              }
            />

            {currentSection.categories.length > 0 ? (
              <div className="sm:max-w-[520px] sm:justify-end">
                <ScrollTabs
                  items={currentSection.categories.map((c) => ({ key: c.key, label: c.label }))}
                  activeKey={softDrinkCategory}
                  onChange={setSoftDrinkCategory}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Content Area */}
        <div>
          {renderedContent}
        </div>
      </div>

      {/* Popup */}
      {popupOpen && (
        <MenuPopupCompact
          item={popupItem}
          loading={popupLoading}
          onClose={closePopup}
          onBuy={handleBuy}
        />
      )}
    </div>
  );
}

export default MenuDashboard;