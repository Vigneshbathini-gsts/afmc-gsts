﻿import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, Minus, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import Pubmenubuyservice from "../services/Pubmenubuyservice";
import ConfirmOrderservice from "../../../services/ConfirmOrderservice";
import { buildStockConsumptionMap, getMaxAllowedQuantity, getPegTypeOrderLimitMessage, isCocktailOrMocktail, isOutOfStock, validateNextQuantity } from "../../../utils/stockValidation";
import { barOrdersAPI, cartAPI } from "../../../services/api";
import { toInitCap } from "../../../utils/textFormat";
import { toast } from "react-toastify";

const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

function getBuyflowOverrideDetails(orderNumber, itemCode) {
  const safeOrder = String(orderNumber || "").trim();
  const safeItemCode = String(itemCode || "").trim();
  if (!safeOrder || !safeItemCode) return null;

  try {
    const raw = localStorage.getItem(`afmc-buyflow-custom:${safeOrder}:${safeItemCode}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const details = parsed?.details;
    console.log("details", details);
    return Array.isArray(details) ? details : null;
  } catch {
    return null;
  }
}

function getBuyflowOverrideStorageKey(orderNumber, itemCode) {
  const safeOrder = String(orderNumber || "").trim();
  const safeItemCode = String(itemCode || "").trim();
  if (!safeOrder || !safeItemCode) return "";
  return `afmc-buyflow-custom:${safeOrder}:${safeItemCode}`;
}

function buildCocktailCustomizationPayload(orderNumber, items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => isCocktailOrMocktail(item))
    .map((item) => {
      const itemCode = String(item?.item_code || "").trim();
      const details = getBuyflowOverrideDetails(orderNumber, itemCode);

      if (!itemCode || !Array.isArray(details) || details.length === 0) {
        return null;
      }

      const ingredients = details
        .map((detail) => {
          const quantity = Number(detail.PEGS ?? detail.pegs ?? detail.QUANTITY ?? detail.quantity ?? 0);
          const rawUnitPrice = detail.UNIT_PRICE ?? detail.unitPrice;
          const rawLinePrice = detail.PRICE ?? detail.memberPrice ?? detail.lineTotal;
          const unitPrice = rawUnitPrice != null && Number.isFinite(Number(rawUnitPrice))
            ? Number(rawUnitPrice)
            : quantity > 0 && rawLinePrice != null && Number.isFinite(Number(rawLinePrice))
              ? Number(rawLinePrice) / quantity
              : undefined;
          const lineTotal = unitPrice != null
            ? Number((unitPrice * quantity).toFixed(2))
            : rawLinePrice != null && Number.isFinite(Number(rawLinePrice))
              ? Number(rawLinePrice)
              : undefined;

          return {
            itemCode: Number(detail.ITEM_CODE ?? detail.itemCode),
            itemName: detail.ITEM_NAME ?? detail.itemName ?? "",
            quantity,
            unitPrice,
            lineTotal,
          };
        })
        .filter((ingredient) => Number.isFinite(ingredient.itemCode) && ingredient.itemCode > 0 && ingredient.quantity > 0);

      if (ingredients.length === 0) {
        return null;
      }

      return {
        itemCode: Number(itemCode),
        ingredients,
      };
    })
    .filter(Boolean);
}

function getCocktailDetailsForItem(orderNumber, item, detailsByItemCode = {}) {
  const itemCode = String(item?.item_code || item?.ITEM_CODE || "").trim();
  if (!itemCode) return null;

  const overrideDetails = getBuyflowOverrideDetails(orderNumber, itemCode);
  if (Array.isArray(overrideDetails)) return overrideDetails;

  const fetchedDetails = detailsByItemCode?.[itemCode];
  return Array.isArray(fetchedDetails) ? fetchedDetails : null;
}

function getItemType(item) {
  const rawType = item?.type ?? item?.TYPE ?? item?.item_type ?? item?.ITEM_TYPE ?? item?.pegType ?? item?.peg_type ?? item?.TYPE_OF_PEG ?? null;
  if (rawType === null || rawType === undefined || rawType === "") {
    return null;
  }
  return String(rawType).trim();
}

function isLargePegType(item) {
  return String(getItemType(item) || "").trim().toLowerCase() === "large";
}

function getItemPegMultiplier(item) {
  return isLargePegType(item) ? 2 : 1;
}

function getMaxAllowedByPegType(item) {
  const maxAllowed = getMaxAllowedQuantity(item);
  if (maxAllowed === null || maxAllowed === undefined) return null;
  const multiplier = getItemPegMultiplier(item);
  if (multiplier <= 1) return maxAllowed;
  return Math.floor(maxAllowed / multiplier);
}

function validateNextQuantityForItem(item, nextQuantity) {
  const qty = Number(nextQuantity);
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, message: "Quantity cannot be less than 1." };
  }

  if (isOutOfStock(item)) {
    return { ok: false, message: "Out of stock." };
  }

  const maxAllowed = getMaxAllowedQuantity(item);
  if (maxAllowed !== null && maxAllowed !== undefined && maxAllowed >= 0) {
    const multiplier = getItemPegMultiplier(item);
    const allowedQty = multiplier > 1 ? Math.floor(maxAllowed / multiplier) : maxAllowed;
    if (allowedQty <= 0) {
      return { ok: false, message: "Out of stock." };
    }
    if (qty > allowedQty) {
      return {
        ok: false,
        message: getPegTypeOrderLimitMessage(item, maxAllowed, `Out of stock. Available quantity: ${allowedQty}`),
      };
    }
  }

  return { ok: true, message: "" };
}

function hasMissingCocktailIngredients(orderNumber, item, detailsByItemCode = {}) {
  if (!isCocktailOrMocktail(item)) return false;
  const details = getCocktailDetailsForItem(orderNumber, item, detailsByItemCode);
  return Array.isArray(details) && details.length === 0;
}

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-IN");
  }
  return date.toLocaleDateString("en-IN");
}

function parseCardText(cardText = "") {
  const normalized = String(cardText).replace(/<br\s*\/?>/gi, " ");
  const nameMatch = normalized.match(/Name:\s*(.*?)\s+Quantity:/i);
  const quantityMatch = normalized.match(/Quantity:\s*(\d+)/i);

  return {
    item_name: nameMatch?.[1]?.trim() || "Item",
    quantity: Number(quantityMatch?.[1] || 1),
  };
}


function resolveCocktailOutOfStock(item, override) {
  const serverSaysOOS = String(item?.stockStatus || "").trim().toLowerCase() === "out of stock"
    || String(item?.stockIssueMessage || "").trim().length > 0;

  if (!override?.hasDetails) {
    // No client recomputation yet — trust the server snapshot only.
    return serverSaysOOS;
  }

  // Once the client recomputation exists, OOS if EITHER source says so.
  return serverSaysOOS || Boolean(override.isOutOfStock);
}

function normalizeItem(item, fallbackIndex = 0) {
  const parsed = parseCardText(item.card_text || item.CARD_TEXT);
  const quantity = Number(item.quantity || item.QUANTITY || parsed.quantity || 1);
  const subtotal = Number(item.subtotal || item.SUBTOTAL || item.unit_price || item.UNIT_PRICE || 0);
  const explicitUnitPrice = Number(item.price || item.PRICE || item.unitPrice || item.UNIT_PRICE);
  const rawOfferQuantity = item.offer_quantity ?? item.OFFER_QUANTITY ?? item.offerQuantity ?? null;
  const rawFreeItemQuantity = item.free_item_quantity ?? item.FREE_ITEM_QUANTITY ?? item.freeItemQuantity ?? null;
  const rawFreeItemCode = item.free_item_code ?? item.FREE_ITEM_CODE ?? item.freeItemCode ?? null;
  const rawFreeItemName = item.free_item_name ?? item.FREE_ITEM_NAME ?? item.freeItemName ?? null;
  const rawFreeItemImage = item.free_item_image ?? item.FREE_ITEM_IMAGE ?? item.freeItemImage ?? null;
  const rawFreeItemAvailableQuantity =
    item.free_item_available_quantity ?? item.FREE_ITEM_AVAILABLE_QUANTITY ?? item.freeItemAvailableQuantity ?? null;
  const rawComputedFreeItemQuantity =
    item.computed_free_item_quantity ?? item.COMPUTED_FREE_ITEM_QUANTITY ?? item.computedFreeItemQuantity ?? null;
  const offer_quantity =
    rawOfferQuantity === null || rawOfferQuantity === undefined || rawOfferQuantity === ""
      ? null
      : Number(rawOfferQuantity);
  const free_item_quantity =
    rawFreeItemQuantity === null || rawFreeItemQuantity === undefined || rawFreeItemQuantity === ""
      ? null
      : Number(rawFreeItemQuantity);
  const free_item_code =
    rawFreeItemCode === null || rawFreeItemCode === undefined || rawFreeItemCode === ""
      ? null
      : Number(rawFreeItemCode);
  const computed_free_item_quantity =
    rawComputedFreeItemQuantity === null ||
      rawComputedFreeItemQuantity === undefined ||
      rawComputedFreeItemQuantity === ""
      ? null
      : Number(rawComputedFreeItemQuantity);
  const parentCodeRaw = item.barcode ?? item.BARCODE ?? item.parent_code ?? item.PARENT_CODE ?? null;
  const parentCode =
    parentCodeRaw === null || parentCodeRaw === undefined || parentCodeRaw === ""
      ? null
      : String(parentCodeRaw);
  const rawAvailableQuantity =
    item.available_quantity ?? item.AVAILABLE_QUANTITY ?? item.stock_quantity ?? item.STOCK_QUANTITY;
  const availableQuantity =
    rawAvailableQuantity === undefined || rawAvailableQuantity === null
      ? null
      : Number(rawAvailableQuantity);
  const rawStockStatus = item.stock_status ?? item.STOCK_STATUS ?? item.stockStatus ?? null;
  const stockStatus =
    rawStockStatus === null || rawStockStatus === undefined || rawStockStatus === ""
      ? null
      : String(rawStockStatus);
  const rawStockIssueMessage =
    item.stock_issue_message ?? item.STOCK_ISSUE_MESSAGE ?? item.stockIssueMessage ?? null;
  const stockIssueMessage =
    rawStockIssueMessage === null || rawStockIssueMessage === undefined || rawStockIssueMessage === ""
      ? null
      : String(rawStockIssueMessage);
  const unitPrice =
    Number.isFinite(explicitUnitPrice) && explicitUnitPrice >= 0
      ? explicitUnitPrice
      : quantity > 0
        ? Number((subtotal / quantity).toFixed(2))
        : 0;

  const isFreeItem = Number(unitPrice || 0) === 0 && Number(subtotal || 0) === 0;
  const rawSubcategory = item.subcategory ?? item.SUBCATEGORY ?? item.sub_category ?? item.SUB_CATEGORY ?? null;
  const subcategory =
    rawSubcategory === null || rawSubcategory === undefined || rawSubcategory === ""
      ? null
      : Number(rawSubcategory);

  const isCocktail = [14, 15].includes(Number(subcategory));
  const normalizedStockStatus = String(stockStatus || "").trim().toLowerCase();
  const hasExplicitStockIssue =
    String(stockIssueMessage || "").trim().length > 0 || normalizedStockStatus === "out of stock";
  const normalizedAvailableQuantity =
    isCocktail && Number(availableQuantity) === 0 && !hasExplicitStockIssue ? null : availableQuantity;

  const rawOrderLineId = item.order_line_id ?? item.ORDER_LINE_ID ?? item.orderLineId ?? item.id ?? 0;
  const orderLineId = Number(rawOrderLineId) || 0;
  const rawItemId = item.item_id ?? item.ITEM_ID ?? null;
  const itemId = rawItemId === null || rawItemId === undefined || rawItemId === "" ? null : Number(rawItemId);
  const rawCartId = item.cart_id ?? item.CART_ID ?? item.cartId ?? null;
  const cartId = rawCartId === null || rawCartId === undefined || rawCartId === "" ? null : Number(rawCartId);
  const fallbackId = orderLineId > 0
    ? orderLineId
    : Number(item.item_id || item.ITEM_ID || item.item_code || item.ITEM_CODE || fallbackIndex) || fallbackIndex;

  return {
    id: fallbackId,
    orderLineId: orderLineId > 0 ? orderLineId : fallbackId,
    item_code: item.item_code || item.ITEM_CODE || "",
    itemId: Number.isFinite(itemId) && itemId > 0 ? itemId : null,
    item_name: item.item_name || item.ITEM_NAME || parsed.item_name,
    quantity,
    unitPrice,
    subtotal,
    image: item.image || item.IMAGE || "",
    card_text: item.card_text || item.CARD_TEXT || "",
    availableQuantity: Number.isFinite(normalizedAvailableQuantity) ? normalizedAvailableQuantity : null,
    parentCode,
    isFreeItem,
    offer_quantity: Number.isFinite(offer_quantity) ? offer_quantity : null,
    free_item_quantity: Number.isFinite(free_item_quantity) ? free_item_quantity : null,
    free_item_code: Number.isFinite(free_item_code) ? free_item_code : null,
    free_item_name: rawFreeItemName ? String(rawFreeItemName) : null,
    free_item_image: rawFreeItemImage ? String(rawFreeItemImage) : null,
    free_item_available_quantity:
      rawFreeItemAvailableQuantity === null ||
        rawFreeItemAvailableQuantity === undefined ||
        rawFreeItemAvailableQuantity === ""
        ? null
        : Number(rawFreeItemAvailableQuantity),
    computed_free_item_quantity: Number.isFinite(computed_free_item_quantity) ? computed_free_item_quantity : null,
    subcategory: Number.isFinite(subcategory) ? subcategory : null,
    type: item.type || item.TYPE || item.item_type || item.ITEM_TYPE || item.pegType || item.peg_type || null,
    stockStatus,
    stockIssueMessage,
    cartId: Number.isFinite(cartId) && cartId > 0 ? cartId : null,
  };
}

function fallbackItemFromState(source) {
  if (!source) {
    return [];
  }

  return [
    {
      id: source.item_id || source.item_code || "selected-item",
      item_code: source.item_code || "",
      item_name: source.item_name || "Item",
      quantity: Number(source.quantity || 1),
      subtotal: Number(source.unit_price || source.subtotal || 0),
      image: source.image || "",
      card_text: `Name: ${source.item_name || "Item"} Quantity: ${source.quantity || 1}`,
    },
  ];
}

function getStockCodeForNormalItem(item) {
  const code = Number(
    item?.itemId ??
    item?.item_id ??
    item?.ITEM_ID ??
    item?.item_code ??
    item?.ITEM_CODE ??
    item?.code ??
    item?.CODE ??
    0
  );
  return Number.isFinite(code) && code > 0 ? code : null;
}

function buildAvailableStockByCode(items = []) {
  const availableByCode = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.isFreeItem || isCocktailOrMocktail(item)) continue;

    const code = getStockCodeForNormalItem(item);
    const available = Number(item?.availableQuantity);
    if (!code || !Number.isFinite(available) || available < 0) continue;

    availableByCode.set(String(code), Math.max(Number(availableByCode.get(String(code)) ?? 0), available));
  }

  return availableByCode;
}

function ActionButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-afmc-maroon active:scale-[0.99] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function Pubmenubuy({
  backTo = "",
  afterConfirmTo = "",
  disableEdit = false,
  hideCocktailEdit = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const [items, setItems] = useState([]);
  const [orderHeader, setOrderHeader] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [updatingLineId, setUpdatingLineId] = useState(null);
  const [error, setError] = useState("");
  const [temporaryStockMessage, setTemporaryStockMessage] = useState("");
  const [cocktailDetailsByItemCode, setCocktailDetailsByItemCode] = useState({});
  const [cocktailOverrideIssues, setCocktailOverrideIssues] = useState({});
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    text: "",
    confirmText: "Yes",
    cancelText: "No",
  });
  const confirmResolveRef = useRef(null);
  const temporaryStockTimerRef = useRef(null);

  const closeConfirmModal = (confirmed) => {
    setConfirmModal((prev) => ({ ...prev, open: false }));
    if (confirmResolveRef.current) {
      confirmResolveRef.current(confirmed);
      confirmResolveRef.current = null;
    }
  };

  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";

  const getStockLimitImageKey = (row) => String(Number(row?.orderLineId ?? row?.id) || row?.id || row?.item_code || "");

  const [stockLimitImageMessages, setStockLimitImageMessages] = useState({});

  const showStockLimitOnImage = useCallback((row, message = "Out of Stock") => {
    const key = getStockLimitImageKey(row);
    if (!key) return;
    setStockLimitImageMessages((current) => ({
      ...current,
      [key]: message,
    }));
    window.setTimeout(() => {
      setStockLimitImageMessages((current) => {
        if (current[key] !== message) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }, 3000);
  }, [getStockLimitImageKey]);

  const clearStockLimitOnImage = useCallback((row) => {
    const key = getStockLimitImageKey(row);
    if (!key) return;
    setStockLimitImageMessages((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, [getStockLimitImageKey]);

  const getCocktailOverrideForItem = (row) => {
    if (!row || !isCocktailOrMocktail(row)) return null;
    const itemCode = String(row?.item_code || "").trim();
    if (!itemCode) return null;
    return cocktailOverrideIssues?.[itemCode] || null;
  };

  const getCocktailDetailsForStockCheck = useCallback((item) => {
    const itemCode = String(item?.item_code || item?.ITEM_CODE || "").trim();
    if (!itemCode) return [];

    const overrideDetails = getBuyflowOverrideDetails(orderNumber, itemCode);
    if (Array.isArray(overrideDetails) && overrideDetails.length > 0) return overrideDetails;

    const fetchedDetails = itemCode ? cocktailDetailsByItemCode?.[itemCode] : null;
    return Array.isArray(fetchedDetails) ? fetchedDetails : [];
  }, [cocktailDetailsByItemCode, orderNumber]);

  useEffect(() => {
    let ignore = false;

    const computeCocktailIssues = async () => {
      if (!orderNumber || items.length === 0) {
        if (!ignore) setCocktailOverrideIssues({});
        return;
      }

      const cocktailItems = items.filter((item) => isCocktailOrMocktail(item));
      if (cocktailItems.length === 0) {
        if (!ignore) setCocktailOverrideIssues({});
        return;
      }

      const entries = cocktailItems
        .map((item) => {
          const itemCode = String(item?.item_code || "").trim();
          const overrideDetails = getBuyflowOverrideDetails(orderNumber, itemCode);
          const fetchedDetails = itemCode ? cocktailDetailsByItemCode[itemCode] : null;
          const details = Array.isArray(overrideDetails) && overrideDetails.length > 0
            ? overrideDetails
            : fetchedDetails;
          if (!itemCode || !Array.isArray(details) || details.length === 0) return null;
          return {
            item,
            itemCode,
            details,
            hasOverride: Array.isArray(overrideDetails) && overrideDetails.length > 0,
          };
        })
        .filter(Boolean);

      if (entries.length === 0) {
        if (!ignore) setCocktailOverrideIssues({});
        return;
      }

      const allCodes = new Set();
      for (const entry of entries) {
        for (const d of entry.details) {
          const code = Number(d?.ITEM_CODE ?? d?.itemCode);
          if (Number.isFinite(code) && code > 0) allCodes.add(code);
        }
      }

      if (allCodes.size === 0) {
        if (!ignore) setCocktailOverrideIssues({});
        return;
      }

      try {
        const currentConsumption = buildStockConsumptionMap(items, { getCocktailDetails: getCocktailDetailsForStockCheck });
        const normalAvailableByCode = buildAvailableStockByCode(items);
        const stockCodes = [...new Set([...currentConsumption.keys()])]
          .filter((code) => Number.isFinite(Number(code)) && Number(code) > 0);

        const stockRes = await cartAPI.getIngredientStocks(stockCodes, orderNumber);
        const stockMap = stockRes?.data?.data || {};

        const next = {};
        for (const entry of entries) {
          const normalizedDetails = entry.details
            .map((d) => ({
              itemCode: Number(d?.ITEM_CODE ?? d?.itemCode),
              itemName: String(d?.ITEM_NAME ?? d?.itemName ?? "").trim(),
              pegs: Number(d?.PEGS ?? d?.pegs ?? d?.QUANTITY ?? d?.quantity ?? 0) || 0,
            }))
            .filter((d) => Number.isFinite(d.itemCode) && d.itemCode > 0 && d.pegs > 0);

          let issueMessage = "";
          let hasUnknownStock = false;
          const multiplier = getItemPegMultiplier(entry.item);
          for (const ing of normalizedDetails) {
            const rawAvailable = normalAvailableByCode.get(String(ing.itemCode)) ?? stockMap?.[String(ing.itemCode)];
            if (rawAvailable === undefined || rawAvailable === null || rawAvailable === "") {
              hasUnknownStock = true;
              continue;
            }
            const available = Number(rawAvailable);
            if (!Number.isFinite(available) || available < 0) {
              hasUnknownStock = true;
              continue;
            }
            const totalRequired = Number(currentConsumption.get(String(ing.itemCode)) || 0);
            if (totalRequired > available) {
              issueMessage = `Out of stock for ingredient ${ing.itemName || ing.itemCode}. Available quantity: ${available}`;
              break;
            }
          }

          next[entry.itemCode] = {
            hasDetails: true,
            hasOverride: entry.hasOverride,
            stockIssueMessage: issueMessage || null,
            isOutOfStock: Boolean(issueMessage),
            hasUnknownStock,
          };
        }

        if (!ignore) setCocktailOverrideIssues(next);
      } catch (err) {
        console.warn("Could not compute cocktail override stock issues:", err);
        if (!ignore) setCocktailOverrideIssues({});
      }
    };

    computeCocktailIssues();

    return () => {
      ignore = true;
    };
  }, [getCocktailDetailsForStockCheck, orderNumber, items, cocktailDetailsByItemCode]);

  const stockIssue = useMemo(() => {
    return (
      items.find((item) => {
        if (isCocktailOrMocktail(item)) {
          return false;
        }

        if (item.isFreeItem) {
          const freeAvailable = item.availableQuantity;

          if (
            freeAvailable === null ||
            freeAvailable === undefined ||
            Number(freeAvailable) <= 0
          ) {
            return false;
          }
        }

        const maxAllowed = getMaxAllowedByPegType(item);

        return (
          maxAllowed !== null &&
          maxAllowed !== undefined &&
          Number(item.quantity || 0) > Number(maxAllowed || 0)
        );
      }) || null
    );
  }, [items]);

 const cocktailStockIssue = useMemo(() => {
  return (
    items.find((item) => {
      if (!isCocktailOrMocktail(item)) return false;
      const itemCode = String(item?.item_code || "").trim();
      const override = itemCode ? cocktailOverrideIssues?.[itemCode] : null;
      return resolveCocktailOutOfStock(item, override);
    }) || null
  );
}, [items, cocktailOverrideIssues]);

  const missingCocktailIngredientItem = useMemo(() => {
    return (
      items.find((item) => hasMissingCocktailIngredients(orderNumber, item, cocktailDetailsByItemCode)) || null
    );
  }, [items, orderNumber, cocktailDetailsByItemCode]);

  const stockIssueMessage = useMemo(() => {
    if (missingCocktailIngredientItem) {
      return "Cocktail/mocktail ingredients are missing. Please edit the item before confirming.";
    }
    if (!stockIssue && !cocktailStockIssue) return "";
    if (cocktailStockIssue) {
      const itemCode = String(cocktailStockIssue?.item_code || "").trim();
      const override = itemCode ? cocktailOverrideIssues?.[itemCode] : null;
      if (override?.hasDetails) {
        return override.stockIssueMessage || "";
      }
      return (
        cocktailStockIssue.stockIssueMessage ||
        "Out of stock for cocktail/mocktail ingredients. Please reduce quantity or update selection."
      );
    }
    const available = Number(getMaxAllowedQuantity(stockIssue) ?? stockIssue.availableQuantity ?? 0);
    return stockIssue.isFreeItem
      ? `Out of stock for free item. Available quantity: ${available}`
      : getPegTypeOrderLimitMessage(stockIssue, available, `Out of stock. Available quantity: ${available}`);
  }, [stockIssue, cocktailStockIssue, cocktailOverrideIssues, missingCocktailIngredientItem]);

  const showToast = (message, type = "success") => {
    if (type === "error") toast.error(message);
    else toast.success(message);
  };

  const validateCombinedStockDemand = useCallback(async (targetItem, nextQtyCandidate) => {
    if (!orderNumber || !targetItem || targetItem.isFreeItem) {
      return { ok: true, message: "" };
    }

    const nextQuantity = Number(nextQtyCandidate);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
      return { ok: true, message: "" };
    }

    const currentQty = Number(targetItem.quantity || 1);
    if (nextQuantity <= currentQty) {
      return { ok: true, message: "" };
    }

    const targetLineId = Number(targetItem.orderLineId ?? targetItem.id);
    if (!Number.isFinite(targetLineId) || targetLineId <= 0) {
      return { ok: true, message: "" };
    }

    const projectedItems = items.map((row) => {
      if (Number(row.orderLineId ?? row.id) === targetLineId) {
        return { ...row, quantity: nextQuantity };
      }
      return row;
    });

    const projectedConsumption = buildStockConsumptionMap(projectedItems, {
      getCocktailDetails: getCocktailDetailsForStockCheck,
    });
    const targetUnitConsumption = buildStockConsumptionMap([{ ...targetItem, quantity: 1 }], {
      getCocktailDetails: getCocktailDetailsForStockCheck,
    });
    const targetIngredientNameByCode = new Map(
      (isCocktailOrMocktail(targetItem) ? getCocktailDetailsForStockCheck(targetItem) : [])
        .map((detail) => {
          const code = Number(detail?.ITEM_CODE ?? detail?.itemCode ?? detail?.item_id ?? detail?.itemId ?? detail?.code ?? detail?.CODE ?? 0);
          const name = String(detail?.ITEM_NAME ?? detail?.itemName ?? detail?.item_name ?? detail?.name ?? "").trim();
          return Number.isFinite(code) && code > 0 && name ? [String(code), name] : null;
        })
        .filter(Boolean)
    );
    const normalAvailableByCode = buildAvailableStockByCode(projectedItems);

    const codes = [...new Set([...targetUnitConsumption.keys()])]
      .filter((code) => Number.isFinite(Number(code)) && Number(code) > 0);

    if (codes.length === 0) {
      return { ok: true, message: "" };
    }

    try {
      const stockRes = await cartAPI.getIngredientStocks(codes, orderNumber);
      const stockMap = stockRes?.data?.data || {};

      for (const code of codes) {
        const projectedRequired = Number(projectedConsumption.get(code) || 0);
        const targetRequiredPerUnit = Number(targetUnitConsumption.get(code) || 0);
        if (!Number.isFinite(targetRequiredPerUnit) || targetRequiredPerUnit <= 0) {
          continue;
        }

        const normalAvailable = normalAvailableByCode.get(String(code));
        const availableRaw = normalAvailable ?? stockMap[String(code)];
        if (availableRaw === undefined || availableRaw === null || availableRaw === "") {
          continue;
        }

        const availableApi = Number(availableRaw);
        if (!Number.isFinite(availableApi) || availableApi < 0) {
          continue;
        }

        if (projectedRequired > availableApi) {
          const otherRequired = Math.max(0, projectedRequired - (targetRequiredPerUnit * nextQuantity));
          const adjustedAvailable = Math.max(0, Math.floor((availableApi - otherRequired) / targetRequiredPerUnit));
          const ingredientName = targetIngredientNameByCode.get(String(code));
          return {
            ok: false,
            message: ingredientName
              ? `Out of stock for ingredient ${ingredientName}. Available quantity: ${adjustedAvailable}`
              : getPegTypeOrderLimitMessage(targetItem, adjustedAvailable, `Out of stock. Available quantity: ${adjustedAvailable}`),
          };
        }
      }
    } catch (err) {
      console.warn("Could not validate combined stock demand:", err);
    }

    return { ok: true, message: "" };
  }, [getCocktailDetailsForStockCheck, items, orderNumber]);

  const showTemporaryStockMessage = (message) => {
    const text = String(message || "").trim();
    if (!text) return;

    if (temporaryStockTimerRef.current) {
      clearTimeout(temporaryStockTimerRef.current);
    }

    setTemporaryStockMessage(text);
    temporaryStockTimerRef.current = setTimeout(() => {
      setTemporaryStockMessage("");
      temporaryStockTimerRef.current = null;
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (temporaryStockTimerRef.current) {
        clearTimeout(temporaryStockTimerRef.current);
      }
    };
  }, []);

  // Track per-item out-of-stock toast cooldowns (timestamps) without causing re-renders.
  // Structure: { [itemKey]: { [normalizedMessage]: timestampMillis } }
  const outOfStockCooldownRef = useRef({});

  const isOutOfStockMessage = (msg) => /out\s*of\s*stock/i.test(String(msg || ""));

  const showToastWithCooldown = (message, type = "success", rowOrKey = null) => {
    if (type !== "error" || !isOutOfStockMessage(message)) {
      showToast(message, type);
      return;
    }

    let key = null;
    if (typeof rowOrKey === "string") {
      key = String(rowOrKey);
    } else if (rowOrKey) {
      try {
        key = getStockLimitImageKey(rowOrKey);
      } catch {
        key = null;
      }
    }

    // If we don't have an item-specific key, don't suppress (avoid global suppression).
    if (!key) {
      showToast(message, type);
      return;
    }

    const now = Date.now();
    const normalized = String(message || "").trim().toLowerCase();
    const map = outOfStockCooldownRef.current || (outOfStockCooldownRef.current = {});
    if (!map[key]) map[key] = {};

    const lastTs = map[key][normalized] || 0;
    const COOLDOWN_MS = 5000;
    if (now - lastTs < COOLDOWN_MS) {
      // suppressed
      return;
    }

    map[key][normalized] = now;
    showToast(message, type);
  };

  const confirmAction = (title, text, confirmButtonText = "Yes", cancelButtonText = "No") => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmModal({
        open: true,
        title,
        text,
        confirmText: confirmButtonText,
        cancelText: cancelButtonText,
      });
    });
  };

  const handleEditCocktail = (item) => {
    if (disableEdit) {
      showToast("Editing is disabled on this page.", "error");
      return;
    }

    const rawItemId =
      item?.itemId ??
      item?.item_id ??
      item?.ITEM_ID ??
      item?.id ??
      item?.item_code ??
      item?.ITEM_CODE ??
      0;
    const itemId = Number(rawItemId) || 0;

    const rawCartId =
      item?.cartId ??
      item?.cart_id ??
      item?.CART_ID ??
      item?.cartID ??
      0;
    const cartId = Number(rawCartId) || 0;

    if (itemId > 0 && cartId > 0) {
      navigate(`${currentBasePath}/item/${encodeURIComponent(itemId)}?cartId=${encodeURIComponent(cartId)}`, {
        state: { cartId },
      });
      return;
    }

    if (itemId > 0) {
      const itemCodeKey = String(item?.item_code || item?.ITEM_CODE || "").trim();
      const prefillDetails = itemCodeKey ? cocktailDetailsByItemCode[itemCodeKey] : null;
      const ingredientsMissing = hasMissingCocktailIngredients(orderNumber, item, cocktailDetailsByItemCode);

      if ((Array.isArray(prefillDetails) && prefillDetails.length > 0) || ingredientsMissing) {
        navigate(`${currentBasePath}/item/${encodeURIComponent(itemId)}`, {
          state: { prefillDetails: Array.isArray(prefillDetails) ? prefillDetails : [], fromBuyFlow: true, orderNumber },
        });
        return;
      }
    }

    showToast("Cart item not linked. Open cart to edit selection.", "error");
    navigate(`${currentBasePath}/cart`);
  };

  const ensureOfferFreeRows = useCallback((nextItems) => {
    if (!Array.isArray(nextItems) || nextItems.length === 0) {
      return [];
    }

    const cleanedItems = nextItems.filter(
      (row) => !(row?.isFreeItem && Number(row?.quantity || 0) <= 0)
    );

    const parents = cleanedItems.filter((row) => !row?.isFreeItem);
    const children = cleanedItems.filter((row) => row?.isFreeItem);
    const hasChildForParent = new Set(
      children
        .map((row) => String(row?.parentCode || "").trim())
        .filter(Boolean)
    );

    const insertionsByAfterId = new Map();

    for (const parent of parents) {
      const parentCode = String(parent?.item_code || "").trim();

      if (!parentCode) continue;

      const expectedFreeQty = calculateFreeQuantity(
        parent?.quantity,
        parent?.offer_quantity,
        parent?.free_item_quantity
      );

      if (expectedFreeQty <= 0) {
        continue;
      }

      if (hasChildForParent.has(parentCode)) {
        continue;
      }

      const freeItemCode = Number(parent?.free_item_code || 0);
      const freeItemName = String(parent?.free_item_name || "Free item").trim() || "Free item";
      const freeItemImage = String(parent?.free_item_image || "").trim();
      const rawFreeItemAvailableQuantity = parent?.free_item_available_quantity;
      const freeItemAvailableQuantity =
        rawFreeItemAvailableQuantity === null ||
          rawFreeItemAvailableQuantity === undefined ||
          rawFreeItemAvailableQuantity === ""
          ? null
          : Number(rawFreeItemAvailableQuantity);

      if (!Number.isFinite(freeItemCode) || freeItemCode <= 0) {
        continue;
      }

      const afterId = Number(parent?.orderLineId ?? parent?.id) || 0;
      const placeholderId = -Date.now() - Math.floor(Math.random() * 1000);

      const placeholder = {
        id: placeholderId,
        orderLineId: placeholderId,
        item_code: String(freeItemCode),
        item_name: freeItemName,
        quantity: expectedFreeQty,
        unitPrice: 0,
        subtotal: 0,
        image: freeItemImage,
        card_text: `Name: ${freeItemName} Quantity: ${expectedFreeQty}`,
        availableQuantity: Number.isFinite(freeItemAvailableQuantity) ? freeItemAvailableQuantity : null,
        parentCode,
        isFreeItem: true,
        offer_quantity: null,
        free_item_quantity: null,
        free_item_code: null,
        computed_free_item_quantity: null,
        subcategory: null,
        stockStatus: null,
        stockIssueMessage: null,
      };

      if (!insertionsByAfterId.has(afterId)) {
        insertionsByAfterId.set(afterId, []);
      }

      insertionsByAfterId.get(afterId).push(placeholder);
    }

    const merged = [];

    for (const row of cleanedItems) {
      merged.push(row);

      const key = Number(row?.orderLineId ?? row?.id) || 0;
      const toAdd = insertionsByAfterId.get(key);

      if (toAdd?.length) {
        merged.push(...toAdd);
      }
    }

    return merged.filter(
      (row) => !(row?.isFreeItem && Number(row?.quantity || 0) <= 0)
    );
  }, []);

  const calculateFreeQuantity = (paidQuantity, offerQuantity, freeItemQuantity) => {
    const paid = Number(paidQuantity || 0);
    if (!Number.isFinite(paid) || paid <= 0) return 0;

    const offerQty = Number(offerQuantity);
    const freeQty = Number(freeItemQuantity);

    if (Number.isFinite(offerQty) && offerQty > 0) {
      const freePerOffer = Number.isFinite(freeQty) && freeQty > 0 ? freeQty : 1;
      return Math.floor(paid / offerQty) * freePerOffer;
    }

    return Math.floor(paid / 2);
  };

  useEffect(() => {
    let ignore = false;

    const fetchItems = async () => {
      if (!orderNumber) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await Pubmenubuyservice.getByOrderNumber(orderNumber);
        const data = response?.data?.data || {};
        const rows = Array.isArray(data?.items) ? data.items : [];
        // console.log("[getByOrderNumberssssss] FETCH RESPONSE", response.data);
        if (!ignore) {
          setOrderHeader(data?.header || null);
          const normalized = rows.map((item, index) => normalizeItem(item, index));
          setItems(ensureOfferFreeRows(normalized));
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(
            fetchError.response?.data?.message || "Unable to load order details."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchItems();
    return () => {
      ignore = true;
    };
  }, [ensureOfferFreeRows, orderNumber]);

  useEffect(() => {
    let ignore = false;

    const fetchCocktailDetails = async () => {
      if (!orderNumber) return;

      const cocktailItems = items.filter((item) => isCocktailOrMocktail(item));
      if (cocktailItems.length === 0) return;

      const uniqueItemCodes = [
        ...new Set(
          cocktailItems
            .map((item) => String(item?.item_code || "").trim())
            .filter(Boolean)
        ),
      ];

      if (uniqueItemCodes.length === 0) return;

      await Promise.all(
        uniqueItemCodes.map(async (itemCode) => {
          if (cocktailDetailsByItemCode[itemCode]) return;

          try {
            const res = await barOrdersAPI.getCocktailDetailsById(itemCode, orderNumber);
            const details = res?.data?.data?.details || [];

            if (!ignore) {
              setCocktailDetailsByItemCode((current) => ({
                ...current,
                [itemCode]: Array.isArray(details) ? details : [],
              }));
            }
          } catch {
            if (!ignore) {
              setCocktailDetailsByItemCode((current) => ({
                ...current,
                [itemCode]: [],
              }));
            }
          }
        })
      );
    };

    fetchCocktailDetails();

    return () => {
      ignore = true;
    };
  }, [items, orderNumber, cocktailDetailsByItemCode]);

  const refreshOrderSummary = async () => {
    if (!orderNumber) return;

    try {
      const refreshed = await Pubmenubuyservice.getByOrderNumber(orderNumber);
      const refreshedData = refreshed?.data?.data || {};
      const refreshedRows = Array.isArray(refreshedData?.items) ? refreshedData.items : [];
      setOrderHeader(refreshedData?.header || null);
      const normalized = refreshedRows.map((item, index) => normalizeItem(item, index));
      setItems(ensureOfferFreeRows(normalized));
    } catch {
      // Ignore refresh failures here; the existing order state is still valid.
    }
  };

  const syncFreeItemQuantities = async () => {
    // No-op by design.
  };

  const adjustQuantity = async (orderLineId, delta) => {
    if (!orderNumber) return;
    const numericOrderLineId = Number(orderLineId);
    if (!Number.isFinite(numericOrderLineId) || numericOrderLineId <= 0) {
      const invalidMessage = "Unable to identify order item for quantity update.";
      setError(invalidMessage);
      showToast(invalidMessage, "error");
      return;
    }

    setUpdatingLineId(numericOrderLineId);
    let validationMessage = "";
    let nextQuantity = null;
    let validationKey = null;

    setItems((current) => {
      const targetItem = current.find((item) => item.orderLineId === numericOrderLineId) || null;
      if (!targetItem) {
        validationMessage = "Item not found.";
        return current;
      }

      if (targetItem.isFreeItem) {
        validationMessage = "Free items cannot be updated.";
        validationKey = getStockLimitImageKey(targetItem);
        return current;
      }

      const currentQty = Number(targetItem.quantity || 1);
      const nextQtyCandidate = currentQty + delta;

      if (nextQtyCandidate < 1) {
        validationMessage = "Quantity cannot be less than 1.";
        validationKey = getStockLimitImageKey(targetItem);
        return current;
      }

      const availableQty = targetItem.availableQuantity;

      const cocktailOverride = getCocktailOverrideForItem(targetItem);
      if (delta > 0) {
        if (cocktailOverride) {
          if (cocktailOverride.isOutOfStock) {
            validationMessage =
              cocktailOverride.stockIssueMessage ||
              "Out of stock for cocktail/mocktail ingredients. Please reduce quantity or update selection.";
            validationKey = getStockLimitImageKey(targetItem);
            return current;
          }
        } else if (String(targetItem.stockIssueMessage || "").trim().length > 0) {
          validationMessage = String(targetItem.stockIssueMessage || "").trim();
          validationKey = getStockLimitImageKey(targetItem);
          return current;
        }
      }

      if (delta > 0) {
        if (!(isCocktailOrMocktail(targetItem) && cocktailOverride && !cocktailOverride.isOutOfStock)) {
          const stockValidation = validateNextQuantityForItem(targetItem, nextQtyCandidate);
          if (!stockValidation.ok) {
            validationMessage =
              stockValidation.message ||
              (availableQty !== null && availableQty !== undefined
                ? `Out of stock. Available quantity: ${availableQty}`
                : "Out of stock.");
            validationKey = getStockLimitImageKey(targetItem);
            return current;
          }
        }
      }

      const expectedFreeQty = calculateFreeQuantity(
        nextQtyCandidate,
        targetItem.offer_quantity,
        targetItem.free_item_quantity      );

      const targetCode = String(targetItem.item_code || "").trim();
      const linkedFreeItems = targetCode
        ? current.filter(
          (item) => item.isFreeItem && String(item.parentCode || "").trim() === targetCode
        )
        : [];

      let freeAvailableQty = null;
      for (const freeItem of linkedFreeItems) {
        if (
          Number(freeItem?.quantity || 0) <= 0 ||
          Number(freeItem?.orderLineId || 0) <= 0
        ) {
          continue;
        }

        const candidateAvailableQty = freeItem?.availableQuantity;
        if (
          candidateAvailableQty !== null &&
          candidateAvailableQty !== undefined &&
          Number.isFinite(Number(candidateAvailableQty))
        ) {
          freeAvailableQty = Number(candidateAvailableQty);
          break;
        }
      }

      const parentFreeAvailableQty = targetItem.free_item_available_quantity;
      if (
        freeAvailableQty === null &&
        parentFreeAvailableQty !== null &&
        parentFreeAvailableQty !== undefined &&
        parentFreeAvailableQty !== "" &&
        Number.isFinite(Number(parentFreeAvailableQty))
      ) {
        freeAvailableQty = Number(parentFreeAvailableQty);
      }

      if (freeAvailableQty !== null && expectedFreeQty > Number(freeAvailableQty)) {
        validationMessage = `Out of stock for free item. Available quantity: ${freeAvailableQty}`;
        validationKey = getStockLimitImageKey(targetItem);
        return current;
      }

      nextQuantity = nextQtyCandidate;

      const nextItems = current
        .map((item) => {
          if (item.orderLineId === numericOrderLineId) {
            const unitPrice = Number(
              item.unitPrice || (currentQty > 0 ? item.subtotal / currentQty : 0) || 0
            );

            const nextSubtotal = Number((unitPrice * nextQtyCandidate).toFixed(2));

            return {
              ...item,
              quantity: nextQtyCandidate,
              unitPrice,
              subtotal: nextSubtotal,
            };
          }

          if (
            item.isFreeItem &&
            String(item.parentCode || "").trim() === targetCode
          ) {
            if (expectedFreeQty <= 0) {
              return null;
            }

            return {
              ...item,
              quantity: expectedFreeQty,
            };
          }

          return item;
        })
        .filter(Boolean);

      const freeItemCode = Number(targetItem.free_item_code || 0);
      const freeItemName = String(targetItem.free_item_name || "Free item").trim() || "Free item";
      const freeItemImage = String(targetItem.free_item_image || "").trim();
      const rawFreeItemAvailableQuantity = targetItem.free_item_available_quantity;
      const freeItemAvailableQuantity =
        rawFreeItemAvailableQuantity === null ||
          rawFreeItemAvailableQuantity === undefined ||
          rawFreeItemAvailableQuantity === ""
          ? null
          : Number(rawFreeItemAvailableQuantity);
      if (
        expectedFreeQty > 0 &&
        linkedFreeItems.length === 0 &&
        Number.isFinite(freeItemCode) &&
        freeItemCode > 0 &&
        targetCode
      ) {
        const placeholderId = -Date.now();
        const placeholder = {
          id: placeholderId,
          orderLineId: placeholderId,
          item_code: String(freeItemCode),
          item_name: freeItemName,
          quantity: expectedFreeQty,
          unitPrice: 0,
          subtotal: 0,
          image: freeItemImage,
          card_text: `Name: ${freeItemName} Quantity: ${expectedFreeQty}`,
          availableQuantity: Number.isFinite(freeItemAvailableQuantity) ? freeItemAvailableQuantity : null,
          parentCode: targetCode,
          isFreeItem: true,
          offer_quantity: null,
          free_item_quantity: null,
          subcategory: null,
          stockStatus: null,
          stockIssueMessage: null,
        };

        const merged = [];
        for (const row of nextItems) {
          merged.push(row);
          if (row.orderLineId === numericOrderLineId) {
            merged.push(placeholder);
          }
        }
        return merged;
      }

      return nextItems;
    });

    setError(validationMessage);
    if (validationMessage) {
      showToastWithCooldown(validationMessage, "error", validationKey);
      setUpdatingLineId(null);
      return;
    }

    if (nextQuantity === null) {
      setUpdatingLineId(null);
      return;
    }

    try {
      const response = await Pubmenubuyservice.updateLineQuantity(orderNumber, numericOrderLineId, nextQuantity);
      const data = response?.data?.data || {};
      const rows = Array.isArray(data?.items) ? data.items : [];
      console.log("[updateLineQuantity] UPDATED RESPONSE", response.data);
      setOrderHeader(data?.header || null);
      const normalized = rows.map((item, index) => normalizeItem(item, index));
      setItems(ensureOfferFreeRows(normalized));
      setError("");
      
      // ✅ SUCCESS TOAST FOR QUANTITY UPDATE
      const action = delta > 0 ? "increased" : "decreased";
      const itemName = items.find((item) => item.orderLineId === numericOrderLineId)?.item_name || "Item";
      showToast(`${itemName} quantity ${action} to ${nextQuantity}`, "success");
      
      console.debug("[Pubmenubuy] quantity update completed", { orderNumber, orderLineId: numericOrderLineId, nextQuantity });
      await syncFreeItemQuantities();
    } catch (updateError) {
      const message = updateError?.response?.data?.message || "Unable to update quantity.";
      setError(message);
      showToast(message, "error");
      try {
        const response = await Pubmenubuyservice.getByOrderNumber(orderNumber);
        const data = response?.data?.data || {};
        console.log("data ss", data);
        const rows = Array.isArray(data?.items) ? data.items : [];
        console.log("[adjustQuantity error] FETCH RESPONSE", response.data);
        setOrderHeader(data?.header || null);
        setItems(ensureOfferFreeRows(rows.map((item, index) => normalizeItem(item, index))));
      } catch {
        // ignore refresh failure
      }
    } finally {
      setUpdatingLineId(null);
    }
  };

  const validateCocktailNextQuantity = async (row, nextQtyCandidate) => {
    if (!row || !isCocktailOrMocktail(row) || !orderNumber) return { ok: true, message: "" };

    const itemCode = String(row?.item_code || "").trim();
    if (!itemCode) return { ok: true, message: "" };

    const overridden = getBuyflowOverrideDetails(orderNumber, itemCode);
    const details = overridden || cocktailDetailsByItemCode?.[itemCode] || null;
    if (!Array.isArray(details) || details.length === 0) return { ok: true, message: "" };

    const ingredients = details
      .map((d) => ({
        itemCode: Number(d?.ITEM_CODE ?? d?.itemCode),
        itemName: String(d?.ITEM_NAME ?? d?.itemName ?? "").trim(),
        pegs: Number(d?.PEGS ?? d?.pegs ?? d?.QUANTITY ?? d?.quantity ?? 0) || 0,
      }))
      .filter((d) => Number.isFinite(d.itemCode) && d.itemCode > 0 && d.pegs > 0);

    if (ingredients.length === 0) return { ok: true, message: "" };

    try {
      const codes = [...new Set(ingredients.map((ing) => ing.itemCode))];
      const stockRes = await cartAPI.getIngredientStocks(codes, orderNumber);
      const stockMap = stockRes?.data?.data || {};

      for (const ing of ingredients) {
        const rawAvailable = stockMap?.[String(ing.itemCode)];
        if (rawAvailable === undefined || rawAvailable === null || rawAvailable === "") {
          continue;
        }
        const available = Number(rawAvailable);
        if (!Number.isFinite(available) || available < 0) continue;

        const required = ing.pegs * Number(nextQtyCandidate || 1);
        if (required > available) {
          return {
            ok: false,
            message: `Out of stock for ingredient ${ing.itemName || ing.itemCode}. Available quantity: ${available}`,
          };
        }
      }

      return { ok: true, message: "" };
    } catch (err) {
      console.warn("Could not validate cocktail ingredient stocks:", err);
      return { ok: true, message: "" };
    }
  };

  const handleQtyClick = async (item, delta) => {
    if (disableEdit) {
      showToast("Quantity changes are disabled on this page.", "error");
      return;
    }

    const lineId = Number(item?.orderLineId ?? item?.id);
    if (!Number.isFinite(lineId) || lineId <= 0) {
      showToast("Unable to identify order item for quantity update.", "error");
      return;
    }

    if (updatingLineId === lineId) {
      showToast("Please wait… updating quantity.", "error");
      return;
    }

    const liveItem = items.find((row) => Number(row?.orderLineId ?? row?.id) === lineId) || item;

    if (liveItem?.isFreeItem) {
      showToast("Free items cannot be updated.", "error");
      return;
    }

    const currentQty = Number(liveItem?.quantity || 1);
    if (delta < 0 && currentQty <= 1) {
      showToast("Quantity cannot be less than 1.", "error");
      return;
    }

    const nextQtyCandidate = currentQty + delta;

    if (delta > 0) {
      if (isCocktailOrMocktail(liveItem)) {
        const validation = await validateCocktailNextQuantity(liveItem, nextQtyCandidate);
        if (!validation.ok) {
          const message = validation.message || "Out of stock for cocktail/mocktail ingredients.";
          showToastWithCooldown(message, "error", liveItem);
          return;
        }
      }

      const cocktailOverride = getCocktailOverrideForItem(liveItem);
      if (cocktailOverride) {
        if (cocktailOverride.isOutOfStock) {
          const message =
            cocktailOverride.stockIssueMessage ||
            "Out of stock for cocktail/mocktail ingredients. Please reduce quantity or update selection.";
          showToastWithCooldown(message, "error", liveItem);
          return;
        }
      } else {
        const stockMessage = String(liveItem?.stockIssueMessage || "").trim();

        if (stockMessage) {
          showToastWithCooldown(stockMessage, "error", liveItem);
          return;
        }
      }

      const combinedValidation = await validateCombinedStockDemand(liveItem, nextQtyCandidate);
      if (!combinedValidation.ok) {
        const message = combinedValidation.message || "Out of stock.";
        showToastWithCooldown(message, "error", liveItem);
        return;
      }
    }

    const availableQty = liveItem?.availableQuantity;
    const liveItemMultiplier = getItemPegMultiplier(liveItem);
    if (
      !isCocktailOrMocktail(liveItem) &&
      availableQty !== null &&
      availableQty !== undefined &&
      Number.isFinite(Number(availableQty))
    ) {
      if (nextQtyCandidate * liveItemMultiplier > Number(availableQty)) {
        const message = getPegTypeOrderLimitMessage(liveItem, availableQty, `Out of stock. Available quantity: ${availableQty}`);
        showToastWithCooldown(message, "error", liveItem);
        showStockLimitOnImage(liveItem, "Out of Stock");
        return;
      }
    }

    const expectedFreeQty = calculateFreeQuantity(
      nextQtyCandidate,
      liveItem?.offer_quantity,
      liveItem?.free_item_quantity
    );

    const parentCode = String(liveItem?.item_code || "").trim();
    if (parentCode && expectedFreeQty > 0) {
      const linkedFreeItems = items.filter(
        (row) => row?.isFreeItem && String(row?.parentCode || "").trim() === parentCode
      );

      let freeAvailableQty = null;
      for (const freeItem of linkedFreeItems) {
        if (
          Number(freeItem?.quantity || 0) <= 0 ||
          Number(freeItem?.orderLineId || 0) <= 0
        ) {
          continue;
        }

        const candidateAvailableQty = freeItem?.availableQuantity;
        if (
          candidateAvailableQty !== null &&
          candidateAvailableQty !== undefined &&
          Number.isFinite(Number(candidateAvailableQty))
        ) {
          freeAvailableQty = Number(candidateAvailableQty);
          break;
        }
      }

      const parentFreeAvailableQty = liveItem?.free_item_available_quantity;
      if (
        freeAvailableQty === null &&
        parentFreeAvailableQty !== null &&
        parentFreeAvailableQty !== undefined &&
        parentFreeAvailableQty !== "" &&
        Number.isFinite(Number(parentFreeAvailableQty))
      ) {
        freeAvailableQty = Number(parentFreeAvailableQty);
      }

      if (freeAvailableQty !== null && expectedFreeQty > Number(freeAvailableQty)) {
        showToastWithCooldown(
          `Out of stock for free item. Available quantity: ${freeAvailableQty}`,
          "error",
          liveItem
        );
        return;
      }
    }

    adjustQuantity(lineId, delta);
  };

  const removeItem = async (id) => {
    if (disableEdit) {
      showToast("Editing is disabled on this page.", "error");
      return;
    }

    const confirmed = await confirmAction(
      "Delete item",
      "Are you sure you want to delete this item?",
      "Delete",
      "Cancel"
    );

    if (!confirmed) {
      return;
    }

    const target = items.find((item) => Number(item.id) === Number(id));

    if (!target) {
      showToast("Unable to identify item for deletion.", "error");
      return;
    }

    if (target.isFreeItem) {
      showToast("Free items cannot be deleted directly.", "error");
      return;
    }

    const targetCode = String(target.item_code || "").trim();
    if (!orderNumber || !targetCode) {
      showToast("Unable to delete this order item.", "error");
      return;
    }

    try {
      setUpdatingLineId(Number(target.orderLineId ?? target.id) || null);
      setError("");
      await Pubmenubuyservice.deleteItem(orderNumber, targetCode);

      const updatedItems = items.filter((item) => {
        if (Number(item.id) === Number(id)) return false;
        return String(item.parentCode || "") !== targetCode;
      });

      setItems(updatedItems);
      showToast("Item deleted successfully", "success");

      const remainingPaidItems = updatedItems.filter((item) => !item.isFreeItem);
      if (remainingPaidItems.length === 0) {
        navigate(`${currentBasePath}/menudash`, {
          replace: true,
        });
      }
    } catch (deleteError) {
      const message = deleteError?.response?.data?.message || "Unable to delete this item.";
      setError(message);
      showToast(message, "error");
    } finally {
      setUpdatingLineId(null);
    }
  };

  const handleCancelOrder = async () => {
    // Validate order is ready to cancel
    if (!orderNumber) {
      showToast("Order number is missing. Please go back and try again.", "error");
      return;
    }

    if (cancelling || loading) {
      if (loading) {
        showToast("Please wait, order is still loading...", "error");
      } else {
        showToast("Cancellation is already in progress...", "error");
      }
      return;
    }

    // Don't allow cancel if we haven't loaded order data yet
    if (items.length === 0 && !loading) {
      showToast("No order data found to cancel. Please try again.", "error");
      return;
    }

    // For newly created orders, wait a moment for backend sync
    if (items.length === 0 && loading) {
      showToast("Order is still loading. Please wait before cancelling.", "error");
      return;
    }

    const confirmed = await confirmAction(
      "Cancel order",
      `Are you sure you want to cancel order ${orderNumber}?`,
      "Yes, cancel",
      "No"
    );

    if (!confirmed) {
      return;
    }

    try {
      setCancelling(true);
      setError("");
      const response = await Pubmenubuyservice.cancelOrder(orderNumber);
      showToast(response?.data?.message || "Order cancelled successfully", "success");

      if (backTo) {
        navigate(backTo, { replace: true });
      } else {
        navigate(location.pathname.replace(/\/buy$/, ""), { replace: true });
      }
    } catch (cancelError) {
      const errorMessage = cancelError?.response?.data?.message || "Unable to cancel this order.";
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmOrder = async () => {
    // Comprehensive validation before confirming
    if (!orderNumber) {
      setError("Order number is missing. Please go back and try again.");
      showToast("Order number is missing", "error");
      return;
    }

    if (confirming || loading) {
      const message = loading ? "Please wait, order is still loading..." : "Confirmation is already in progress...";
      showToast(message, "error");
      return;
    }

    // Check if items are loaded
    if (items.length === 0 && !loading) {
      setError("No items found in this order. Please add items before confirming.");
      showToast("No items to confirm", "error");
      return;
    }

    // For newly created orders, wait a moment for backend sync
    if (items.length === 0 && loading) {
      showToast("Order is still loading. Please wait before confirming.", "error");
      return;
    }

    // Check for stock issues
    if (stockIssueMessage) {
      showTemporaryStockMessage(stockIssueMessage);
      showToast(stockIssueMessage, "error");
      return;
    }

    const confirmed = await confirmAction(
      "Confirm order",
      `Are you sure you want to confirm order ${orderNumber}?`,
      "Confirm",
      "Cancel"
    );

    if (!confirmed) {
      return;
    }

    try {
      setConfirming(true);
      setError("");

      const cocktailCustomizations = buildCocktailCustomizationPayload(orderNumber, items);

      // Validate that we have valid items to confirm
      const confirmedItems = Array.isArray(items) ? items : [];
      for (const item of confirmedItems) {
        if (item.isFreeItem) continue;
        if (isCocktailOrMocktail(item)) {
          const validation = await validateCocktailNextQuantity(item, item.quantity);
          if (!validation.ok) {
            setError(validation.message);
            showToast(validation.message || "Out of stock for cocktail/mocktail ingredients.", "error");
            setConfirming(false);
            return;
          }
        } else {
          const validation = validateNextQuantityForItem(item, item.quantity);
          if (!validation.ok) {
            setError(validation.message);
            showToast(validation.message || "Out of stock.", "error");
            setConfirming(false);
            return;
          }
        }
      }

      const validItems = confirmedItems
        .map((it) => ({
          item_id: Number(it.itemId || it.item_id || it.item_code || it.id || 0) || 0,
          order_line_id: Number(it.orderLineId || it.order_line_id || 0) || 0,
          barcode: it.parentCode || it.barcode || null,
          is_free_item: Boolean(it.isFreeItem),
          quantity: Number(it.quantity || 0),
        }))
        .filter((x) => Number.isFinite(x.item_id) && x.item_id > 0 && x.quantity > 0);

      if (validItems.length === 0) {
        setError("No valid items to confirm. Please add items to your order.");
        showToast("No valid items to confirm", "error");
        setConfirming(false);
        return;
      }

      const payload = {};
      if (cocktailCustomizations.length > 0) payload.cocktailCustomizations = cocktailCustomizations;
      if (validItems.length > 0) payload.items = validItems;

      await ConfirmOrderservice.confirmOrder(orderNumber, payload);

      showToast("Order confirmed successfully", "success");

      // Clear any stored overrides
      cocktailCustomizations.forEach((customization) => {
        const key = getBuyflowOverrideStorageKey(orderNumber, customization.itemCode);
        if (key) {
          localStorage.removeItem(key);
        }
      });

      // Navigate to confirmation page
      if (afterConfirmTo) {
        navigate(`${afterConfirmTo}?orderNumber=${encodeURIComponent(orderNumber)}`, {
          replace: true,
          state: { orderNumber },
        });
      } else {
        navigate(`${currentBasePath}/Buyflowconfirmorder?orderNumber=${encodeURIComponent(orderNumber)}`, {
          replace: true,
          state: { orderNumber },
        });
      }
    } catch (confirmError) {
      console.error(" :", confirmError);
      const errorMessage = confirmError?.response?.data?.message ||
        confirmError?.message ||
        "Unable to confirm this order. Please try again.";
      if (isOutOfStockMessage(errorMessage)) {
        setError("");
        showTemporaryStockMessage(errorMessage);
      } else {
        setError(errorMessage);
      }
      
      // Refresh data to get actual stock levels from the server
      await refreshOrderSummary();
      
      showToast(errorMessage, "error");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 px-3 py-4 md:px-6">
      <div className="mx-auto max-w-[1180px] space-y-4">
        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-afmc-gold/20 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          <div className="bg-afmc-maroon px-5 py-5 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/80">
                  {toInitCap("Order Details")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton
                  onClick={() => (backTo ? navigate(backTo, { replace: true }) : navigate(-1))}
                  className="bg-white/15 px-4 py-2 hover:bg-white/25"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {toInitCap("Back")}
                </ActionButton>

                <ActionButton
                  onClick={handleConfirmOrder}
                  disabled={loading || confirming || Boolean(stockIssueMessage) || items.length === 0}
                  className="bg-afmc-maroon px-4 py-2 text-white ring-1 ring-afmc-gold/30 hover:bg-afmc-maroon/90 disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    loading ? "Loading order details..." :
                      items.length === 0 ? "No items to confirm" :
                        stockIssueMessage ? stockIssueMessage :
                          "Confirm order"
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {loading ? toInitCap("Loading...") : confirming ? toInitCap("Confirming...") : toInitCap("Confirm")}
                </ActionButton>

                <ActionButton
                  onClick={handleCancelOrder}
                  disabled={loading || cancelling || items.length === 0}
                  className="bg-white/10 px-4 py-2 text-white shadow-sm ring-1 ring-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  title={
                    loading ? "Loading order details..." :
                      items.length === 0 ? "No order to cancel" :
                        "Cancel order"
                  }
                >
                  <XCircle className="h-4 w-4" />
                  {loading ? toInitCap("Loading...") : cancelling ? toInitCap("Cancelling...") : toInitCap("Cancel")}
                </ActionButton>
              </div>
            </div>
          </div>

          {/* Summary */}
         <div className="grid gap-3 border-t border-stone-200 bg-white p-4 grid-cols-2 md:grid-cols-3">
    <div className="rounded-xl border border-stone-200 bg-white p-3">
        <p className="text-xs text-stone-500">{toInitCap("Order Number")}</p>
        <h3 className="mt-1 text-xl font-semibold text-stone-900">
            {orderHeader?.order_num || orderNumber}
        </h3>
    </div>

    <div className="rounded-xl border border-stone-200 bg-white p-3">
        <p className="text-xs text-stone-500">{toInitCap("Order Date")}</p>
        <h3 className="mt-1 text-xl font-semibold text-stone-900">
            {formatDate(orderHeader?.order_date)}
        </h3>
    </div>

    <div className="rounded-xl border border-afmc-gold/20 bg-gradient-to-br from-white to-afmc-gold/5 p-3 col-span-2 md:col-span-1 md:col-start-3">
        <p className="text-xs text-stone-500">{toInitCap("Items")}</p>
        <h3 className="mt-1 text-xl font-semibold text-afmc-maroon">
            {items.filter((row) => Number(row?.quantity || 0) > 0).length}
        </h3>
        <p className="mt-0.5 text-xs text-stone-500">{toInitCap("Review before confirm")}</p>
    </div>
</div>
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          {loading ? (
            <div className="py-16 text-center text-sm text-stone-500">
              {toInitCap("Loading order details...")}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-500">
              {toInitCap("No items found for this order.")}
            </div>
          ) : (
            <div className="space-y-4">
              {temporaryStockMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {temporaryStockMessage}
                </div>
              ) : null}
              {/* Products */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items
                  .map((item) => {
                    const missingCocktailIngredients = hasMissingCocktailIngredients(orderNumber, item, cocktailDetailsByItemCode);
                    const isCocktailItem = isCocktailOrMocktail(item);
                    const cocktailOverride = isCocktailItem ? getCocktailOverrideForItem(item) : null;
                    
                    // Determine if the item is out of stock based on current availableQuantity vs requested quantity
                                    const itemMultiplier = getItemPegMultiplier(item);
                    const isStandardOutOfStock =
                      !isCocktailItem && !item.isFreeItem && item.availableQuantity !== null &&
                      Number(item.quantity) * itemMultiplier > Number(item.availableQuantity);
                   const isCardOutOfStock =
  isCocktailItem
    ? resolveCocktailOutOfStock(item, cocktailOverride)
    : Boolean(isStandardOutOfStock || Number(item.availableQuantity) === 0);
                    
                    const imageStockMessage = isCocktailItem
                      ? (isCardOutOfStock ? "Out of Stock" : "")
                      : (isStandardOutOfStock || Number(item.availableQuantity) === 0 ? "Out of Stock" : "");
                      
                    const disablePlusForStock =
                      isCocktailItem
                        ? (() => {
                          if (cocktailOverride?.hasDetails) return Boolean(cocktailOverride.isOutOfStock);
                          return String(item.stockIssueMessage || "").trim().length > 0 || isOutOfStock(item);
                        })()
                        : false;
                    const disableQuantityControls = disableEdit || updatingLineId === Number(item.orderLineId ?? item.id) || isCardOutOfStock;

                    return (
                      <div
                        key={item.orderLineId ?? item.id}
                        className={`group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-afmc-gold/40 focus-within:ring-offset-2 focus-within:ring-offset-stone-50 ${isCardOutOfStock ? "border-red-200 bg-red-50/20" : "hover:-translate-y-0.5 hover:border-afmc-gold/40 hover:shadow-md"}`}
                      >
                        {/* Image */}
                        <div className="relative flex h-40 items-center justify-center overflow-hidden bg-stone-50 p-4">
                          <img
                            src={`${BASEAPI}${item.image || "default.jpg"}`}
                            alt={item.item_name}
                            className={`max-h-full w-auto object-contain transition duration-300 group-hover:scale-[1.03] ${imageStockMessage ? "opacity-45" : ""}`}
                          />
                          {imageStockMessage ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/35 px-3 text-center">
                              <span className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm">
                                {imageStockMessage}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {/* Details */}
                        <div className="space-y-3 p-4">
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="line-clamp-1 text-base font-semibold text-stone-900">
                                {toInitCap(item.item_name)}
                              </h3>
                              {!disableEdit && !hideCocktailEdit && isCocktailOrMocktail(item) && (!item.isFreeItem || missingCocktailIngredients) ? (
                                <button
                                  type="button"
                                  onClick={() => handleEditCocktail(item)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-afmc-gold/40 hover:bg-afmc-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                  title={toInitCap("Edit ingredients")}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  {toInitCap("Edit")}
                                </button>
                              ) : null}
                            </div>

                            <p className="mt-1 text-sm text-stone-500">
                              {toInitCap("Quantity")}: <span className="font-semibold text-stone-800">{item.quantity}</span>
                              {item.isFreeItem && !missingCocktailIngredients ? (
                                <span className="ml-1 rounded-full bg-afmc-gold/10 px-2 py-0.5 text-[11px] font-semibold text-afmc-maroon">
                                  {toInitCap("Free")}
                                </span>
                              ) : null}
                            </p>
                            {/* {item.type ? (
                              <p className="mt-1 text-sm text-stone-500">
                                {toInitCap("Type")}: <span className="font-semibold text-stone-800">{toInitCap(item.type)}</span>
                              </p>
                            ) : null} */}
                            {isCocktailOrMocktail(item) && (() => {
                              const itemCode = String(item?.item_code || "").trim();
                              const override = itemCode ? cocktailOverrideIssues?.[itemCode] : null;
                             const statusText = isCocktailOrMocktail(item)
  ? (resolveCocktailOutOfStock(item, cocktailOverrideIssues?.[String(item?.item_code || "").trim()])
      ? "Out Of Stock"
      : "In Stock")
  : "";

                              if (!statusText || missingCocktailIngredients) return null;

                              return (
                                <p
                                  className={`mt-1 text-xs font-semibold ${String(statusText).toLowerCase() === "out of stock" ? "text-red-600" : "text-green-700"}`}
                                >
                                  {toInitCap(statusText)}
                                </p>
                              );
                            })()}
                            {isCocktailOrMocktail(item) && (() => {
                              const itemCode = String(item?.item_code || "").trim();
                              const override = itemCode ? cocktailOverrideIssues?.[itemCode] : null;
                              const message = override?.hasDetails
                                ? (override.stockIssueMessage || "")
                                : String(item.stockIssueMessage || "").trim();

                              if (!message) return null;

                              return (
                                <p className="mt-1 text-xs font-semibold text-red-600">
                                  {message}
                                </p>
                              );
                            })()}

                            {isCocktailOrMocktail(item) && (() => {
                              const itemCode = String(item?.item_code || "").trim();
                              const overridden = getBuyflowOverrideDetails(orderNumber, itemCode);
                              const details = overridden || (itemCode ? cocktailDetailsByItemCode[itemCode] : null);
                              if (!details || details.length === 0) {
                                if (missingCocktailIngredients) {
                                  return (
                                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                                      Ingredients missing. Edit this item to add ingredients.
                                    </div>
                                  );
                                }
                                return null;
                              }

                              return (
                                <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-700">
                                  <p className="mb-1 font-semibold text-stone-800">Ingredients</p>
                                  <ul className="space-y-0.5">
                                    {details.slice(0, 6).map((ing, idx) => (
                                      <li key={`${ing.ITEM_CODE || ing.itemCode || idx}`} className="flex justify-between gap-2">
                                        <span className="truncate">{toInitCap(ing.ITEM_NAME || ing.itemName || "Item")}</span>
                                        <span className="shrink-0 text-stone-600">
                                          {Number(ing.PEGS ?? ing.pegs ?? ing.QUANTITY ?? ing.quantity ?? 0) || 0}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                  {details.length > 6 ? (
                                    <p className="mt-1 text-[11px] text-stone-500">+{details.length - 6} more…</p>
                                  ) : null}
                                </div>
                              );
                            })()}
                            {!isCocktailItem && !item.isFreeItem && item.availableQuantity !== null && item.availableQuantity !== undefined && (
                              <p className="mt-1 text-xs text-stone-400">
                                {/* Available: {item.availableQuantity} */}
                              </p>
                            )}
                            {!isCocktailItem &&
                              !item.isFreeItem &&
                              item.availableQuantity !== null &&
                              item.availableQuantity !== undefined &&
                              Number(item.quantity || 0) > Number(item.availableQuantity || 0) && (
                                null
                              )}
                          </div>

                          {/* Controls */}
                          {!item.isFreeItem ? (
                            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleQtyClick(item, -1)}
                                  aria-disabled={disableQuantityControls || item.quantity <= 1}
                                  disabled={disableQuantityControls || item.quantity <= 1}
                                  className={`rounded-md bg-white p-1.5 text-stone-700 shadow-sm transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 ${disableQuantityControls || item.quantity <= 1
                                    ? "opacity-50"
                                    : ""
                                    }`}
                                >
                                  <Minus className="h-4 w-4" />
                                </button>

                                <span className="min-w-[28px] text-center text-sm font-semibold text-stone-900">
                                  {item.quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleQtyClick(item, 1)}
                                  aria-disabled={
                                    disableQuantityControls ||
                                    disablePlusForStock
                                  }
                                  disabled={
                                    disableQuantityControls ||
                                    disablePlusForStock || isStandardOutOfStock
                                  }
                                  className={`rounded-md bg-afmc-maroon p-1.5 text-white shadow-sm transition hover:bg-afmc-maroon2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 ${updatingLineId === Number(item.orderLineId ?? item.id) ||
                                    disablePlusForStock || isStandardOutOfStock
                                    ? "opacity-60"
                                    : ""
                                    }`}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={disableEdit}
                                className={`rounded-md bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 ${disableEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : !missingCocktailIngredients ? (
                            <div className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600">
                              Free item
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmModal.open && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">{confirmModal.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{confirmModal.text}</p>
                </div>
                <button
                    type="button"
                    onClick={() => closeConfirmModal(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                    aria-label="Close"
                >
                    ×
                </button>
            </div>
            <div className="mt-6 flex flex-row gap-3 justify-end">
                <button
                    type="button"
                    onClick={() => closeConfirmModal(false)}
                    className="flex-1 sm:flex-none inline-flex justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                    {confirmModal.cancelText}
                </button>
                <button
                    type="button"
                    onClick={() => closeConfirmModal(true)}
                    className="flex-1 sm:flex-none inline-flex justify-center rounded-full bg-afmc-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-afmc-maroon2"
                >
                    {confirmModal.confirmText}
                </button>
            </div>
        </div>
    </div>
)}
    </div>
  );
}
