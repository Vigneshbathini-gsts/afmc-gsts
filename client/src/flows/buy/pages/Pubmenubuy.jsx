import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, Minus, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import Pubmenubuyservice from "../services/Pubmenubuyservice";
import ConfirmOrderservice from "../../../services/ConfirmOrderservice";
import { getMaxAllowedQuantity, isCocktailOrMocktail, isOutOfStock, validateNextQuantity } from "../../../utils/stockValidation";
import { barOrdersAPI, cartAPI } from "../../../services/api";
import { toInitCap } from "../../../utils/textFormat";

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

function Toast({ message, type = "success", onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Reset visibility whenever a new toast message is shown
    setIsVisible(true);
  }, [message, type]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, type, onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg p-4 ${type === "error" ? "bg-red-600" : "bg-green-600"
        } text-white min-w-[220px] transition-all duration-300 ease-in-out pointer-events-auto ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{message}</span>
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose?.(), 300);
          }}
          className="hover:opacity-80"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
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

  // Some order-details payloads may send `available_quantity: 0` for cocktails/mocktails while
  // ingredient-based availability is still being computed server-side. Treat that as "unknown"
  // unless an explicit out-of-stock status/message is present, to avoid showing false OOS.
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
  const [toast, setToast] = useState(null);
  const [cocktailDetailsByItemCode, setCocktailDetailsByItemCode] = useState({});
  const [cocktailOverrideIssues, setCocktailOverrideIssues] = useState({});
  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";
  const MAX_QTY = 99;

  const getCocktailOverrideForItem = (row) => {
    if (!row || !isCocktailOrMocktail(row)) return null;
    const itemCode = String(row?.item_code || "").trim();
    if (!itemCode) return null;
    return cocktailOverrideIssues?.[itemCode] || null;
  };

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
        const stockRes = await cartAPI.getIngredientStocks([...allCodes], orderNumber);
        const stockMap = stockRes?.data?.data || {};

        const next = {};
        for (const entry of entries) {
          const parentQty = Number(entry.item?.quantity || 1) || 1;
          const normalizedDetails = entry.details
            .map((d) => ({
              itemCode: Number(d?.ITEM_CODE ?? d?.itemCode),
              itemName: String(d?.ITEM_NAME ?? d?.itemName ?? "").trim(),
              pegs: Number(d?.PEGS ?? d?.pegs ?? d?.QUANTITY ?? d?.quantity ?? 0) || 0,
            }))
            .filter((d) => Number.isFinite(d.itemCode) && d.itemCode > 0 && d.pegs > 0);

          let issueMessage = "";
          let hasUnknownStock = false;
          for (const ing of normalizedDetails) {
            const rawAvailable = stockMap?.[String(ing.itemCode)];
            if (rawAvailable === undefined || rawAvailable === null || rawAvailable === "") {
              // If backend didn't return stock for an ingredient code, treat as unknown (do not hard-block).
              hasUnknownStock = true;
              continue;
            }
            const available = Number(rawAvailable);
            if (!Number.isFinite(available) || available < 0) {
              hasUnknownStock = true;
              continue;
            }
            const required = ing.pegs * parentQty;
            if (required > available) {
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
  }, [orderNumber, items, cocktailDetailsByItemCode]);
  const stockIssue = useMemo(() => {
    return (
      items.find((item) => {
        // Cocktail/mocktail stock validation is handled separately (and may be overridden by edited ingredients).
        if (isCocktailOrMocktail(item)) {
          return false;
        }

        // Ignore free-item stock validation
        // when backend sends 0/null stock
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

        const maxAllowed = getMaxAllowedQuantity(item);

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
      items.find(
        (item) => {
          if (!isCocktailOrMocktail(item)) return false;
          const itemCode = String(item?.item_code || "").trim();
          const override = itemCode ? cocktailOverrideIssues?.[itemCode] : null;
          if (override?.hasDetails) {
            return Boolean(override.isOutOfStock);
          }
          return isOutOfStock(item);
        }
      ) || null
    );
  }, [items, cocktailOverrideIssues]);

  const stockIssueMessage = useMemo(() => {
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
      : `Out of stock. Available quantity: ${available}`;
  }, [stockIssue, cocktailStockIssue, cocktailOverrideIssues]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
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

      if (Array.isArray(prefillDetails) && prefillDetails.length > 0) {
        navigate(`${currentBasePath}/item/${encodeURIComponent(itemId)}`, {
          state: { prefillDetails, fromBuyFlow: true, orderNumber },
        });
        return;
      }
    }

    showToast("Cart item not linked. Open cart to edit selection.", "error");
    navigate(`${currentBasePath}/cart`);
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
        console.log("[getByOrderNumber] FETCH RESPONSE", response.data);
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
  }, [orderNumber]);

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

  const ensureOfferFreeRows = (nextItems) => {
    if (!Array.isArray(nextItems) || nextItems.length === 0) {
      return [];
    }

    // NEVER keep free rows with qty <= 0
    const cleanedItems = nextItems.filter(
      (row) => !(row?.isFreeItem && Number(row?.quantity || 0) <= 0)
    );

    const parents = cleanedItems.filter((row) => !row?.isFreeItem);

    const children = cleanedItems.filter(
      (row) => row?.isFreeItem
    );

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

      // REMOVE FREE ITEM COMPLETELY
      if (expectedFreeQty <= 0) {
        continue;
      }

      // Already exists
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

      const afterId =
        Number(parent?.orderLineId ?? parent?.id) || 0;

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

      const key =
        Number(row?.orderLineId ?? row?.id) || 0;

      const toAdd = insertionsByAfterId.get(key);

      if (toAdd?.length) {
        merged.push(...toAdd);
      }
    }

    return merged.filter(
      (row) => !(row?.isFreeItem && Number(row?.quantity || 0) <= 0)
    );
  };



  const calculateFreeQuantity = (paidQuantity, offerQuantity, freeItemQuantity) => {
    const paid = Number(paidQuantity || 0);
    if (!Number.isFinite(paid) || paid <= 0) return 0;

    const offerQty = Number(offerQuantity);
    const freeQty = Number(freeItemQuantity);

    if (Number.isFinite(offerQty) && offerQty > 0) {
      const freePerOffer = Number.isFinite(freeQty) && freeQty > 0 ? freeQty : 1;
      return Math.floor(paid / offerQty) * freePerOffer;
    }

    // Fallback: Buy 2 get 1 free
    return Math.floor(paid / 2);
  };

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
    // Free items are computed/persisted by the backend in `updateLineQuantity` and returned in its response.
    // A follow-up refetch here can overwrite fresh local state with stale backend data under some conditions.
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

    setItems((current) => {
      const targetItem = current.find((item) => item.orderLineId === numericOrderLineId) || null;
      if (!targetItem) {
        validationMessage = "Item not found.";
        return current;
      }

      if (targetItem.isFreeItem) {
        validationMessage = "Free items cannot be updated.";
        return current;
      }

      const currentQty = Number(targetItem.quantity || 1);
      const nextQtyCandidate = currentQty + delta;

      if (nextQtyCandidate < 1) {
        validationMessage = "Quantity cannot be less than 1.";
        return current;
      }

      if (nextQtyCandidate > MAX_QTY) {
        validationMessage = `Quantity cannot be more than ${MAX_QTY}.`;
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
            return current;
          }
        } else if (String(targetItem.stockIssueMessage || "").trim().length > 0) {
          validationMessage = String(targetItem.stockIssueMessage || "").trim();
          return current;
        }
      }

      // Only validate "next qty" against stock when increasing quantity.
      // Decreasing should always be allowed (down to 1), even if the item is currently marked OOS.
      if (delta > 0) {
        if (!(isCocktailOrMocktail(targetItem) && cocktailOverride && !cocktailOverride.isOutOfStock)) {
          const stockValidation = validateNextQuantity(targetItem, nextQtyCandidate);
          if (!stockValidation.ok) {
            validationMessage =
              stockValidation.message ||
              (availableQty !== null && availableQty !== undefined
                ? `Out of stock. Available quantity: ${availableQty}`
                : "Out of stock.");
            return current;
          }
        }
      }

      const expectedFreeQty = calculateFreeQuantity(
        nextQtyCandidate,
        targetItem.offer_quantity,
        targetItem.free_item_quantity
      );

      const targetCode = String(targetItem.item_code || "").trim();
      const linkedFreeItems = targetCode
        ? current.filter(
          (item) => item.isFreeItem && String(item.parentCode || "").trim() === targetCode
        )
        : [];

      let freeAvailableQty = null;
      for (const freeItem of linkedFreeItems) {
        // Ignore stale/placeholder/generated free rows
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
        return current;
      }

      nextQuantity = nextQtyCandidate;

      const nextItems = current
        .map((item) => {
          // Update parent item
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

          // Update linked free items
          if (
            item.isFreeItem &&
            String(item.parentCode || "").trim() === targetCode
          ) {
            // REMOVE FREE ITEM COMPLETELY
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

      // If the parent crosses the offer threshold, the linked free line may not exist yet.
      // Optimistically create a placeholder free row so the UI updates immediately; it will be
      // replaced by the backend response after `updateLineQuantity`.
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
      showToast(validationMessage, "error");
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
      showToast("Quantity updated successfully", "success");
      // The backend response already returns an updated order summary (including offer-linked free items).
      // Avoid an immediate refetch here; it can briefly reintroduce stale quantities in slow networks.
      await syncFreeItemQuantities();
    } catch (updateError) {
      const message = updateError?.response?.data?.message || "Unable to update quantity.";
      setError(message);
      showToast(message, "error");
      try {
        const response = await Pubmenubuyservice.getByOrderNumber(orderNumber);
        const data = response?.data?.data || {};
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
          // Missing stock data should not hard-block quantity updates.
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
      showToast("Please waitΓÇª updating quantity.", "error");
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

    if (delta > 0 && currentQty >= MAX_QTY) {
      showToast(`Quantity cannot be more than ${MAX_QTY}.`, "error");
      return;
    }

    const nextQtyCandidate = currentQty + delta;

    // Cocktail/mocktail stock validation (mirrors CartPage behavior)
    if (delta > 0) {
      if (isCocktailOrMocktail(liveItem)) {
        const validation = await validateCocktailNextQuantity(liveItem, nextQtyCandidate);
        if (!validation.ok) {
          showToast(validation.message || "Out of stock for cocktail/mocktail ingredients.", "error");
          return;
        }
      }

      const cocktailOverride = getCocktailOverrideForItem(liveItem);
      if (cocktailOverride) {
        if (cocktailOverride.isOutOfStock) {
          showToast(
            cocktailOverride.stockIssueMessage ||
              "Out of stock for cocktail/mocktail ingredients. Please reduce quantity or update selection.",
            "error"
          );
          return;
        }
      } else {
        const stockMessage = String(liveItem?.stockIssueMessage || "").trim();

        // Backend may return ingredient-level stock issues via message only (often for cocktail/mocktail),
        // without reliable subcategory/stockStatus in this screen's payload.
        if (stockMessage) {
          showToast(stockMessage, "error");
          return;
        }
        // Do not hard-block on cocktail/mocktail `stockStatus` here; it is often stale/incorrect in buy-flow.
      }
    }

    const availableQty = liveItem?.availableQuantity;
    if (
  !isCocktailOrMocktail(liveItem) &&
  availableQty !== null &&
  availableQty !== undefined &&
  Number.isFinite(Number(availableQty))
) {
  if (nextQtyCandidate > Number(availableQty)) {
    showToast(`Out of stock. Available quantity: ${availableQty}`, "error");
    return;
  }
}

    // Offer/free-item stock validation (same messaging as cart)
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
        // Ignore stale/placeholder/generated free rows
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
        showToast(
          `Out of stock for free item. Available quantity: ${freeAvailableQty}`,
          "error"
        );
        return;
      }
    }

    adjustQuantity(lineId, delta);
  };

const removeItem = (id) => {
  if (disableEdit) {
    showToast("Editing is disabled on this page.", "error");
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to delete this item?"
  );

  if (!confirmed) {
    return;
  }

  setItems((current) => {
    const target = current.find((item) => item.id === id);

    if (!target) return current;
    if (target.isFreeItem) return current;

    const targetCode = String(target.item_code || "").trim();

    let updatedItems = [];

    if (!targetCode) {
      updatedItems = current.filter((item) => item.id !== id);
    } else {
      // Remove parent + linked free items
      updatedItems = current.filter((item) => {
        if (item.id === id) return false;
        return String(item.parentCode || "") !== targetCode;
      });
    }

    const remainingPaidItems = updatedItems.filter(
      (item) => !item.isFreeItem
    );

    // Navigate if no items left
    if (remainingPaidItems.length === 0) {
      // if (backTo) {
      //   navigate(backTo, { replace: true });
      // } else {
        navigate(`${currentBasePath}/menudash`, {
          replace: true,
        });
      // }
    }

    return updatedItems;
  });
};

  const handleCancelOrder = async () => {
    if (!orderNumber || cancelling) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to cancel order`
    );

    if (!confirmed) {
      return;
    }

    try {
      setCancelling(true);
      setError("");
      const response = await Pubmenubuyservice.cancelOrder(orderNumber);
      // window.alert(response?.data?.message || "Order cancelled");
      if (backTo) {
        navigate(backTo, { replace: true });
      } else {
        navigate(location.pathname.replace(/\/buy$/, ""), { replace: true });
      }
    } catch (cancelError) {
      setError(
        cancelError.response?.data?.message || "Unable to cancel this order."
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!orderNumber || confirming || loading || Boolean(stockIssueMessage)) {
      return;
    }

    try {
      setConfirming(true);
      setError("");
      const cocktailCustomizations = buildCocktailCustomizationPayload(orderNumber, items);
      // Include latest item quantities in the payload so backend can persist updates
      const itemsPayload = (Array.isArray(items) ? items : [])
        .map((it) => ({
          item_id: Number(it.itemId || it.item_id || it.item_code || it.id || 0) || 0,
          order_line_id: Number(it.orderLineId || it.order_line_id || 0) || 0,
          barcode: it.parentCode || it.barcode || null,
          is_free_item: Boolean(it.isFreeItem),
          quantity: Number(it.quantity || 0),
        }))
        .filter((x) => Number.isFinite(x.item_id) && x.item_id > 0);

      const payload = {};
      if (cocktailCustomizations.length > 0) payload.cocktailCustomizations = cocktailCustomizations;
      if (itemsPayload.length > 0) payload.items = itemsPayload;

      await ConfirmOrderservice.confirmOrder(orderNumber, payload);
      cocktailCustomizations.forEach((customization) => {
        const key = getBuyflowOverrideStorageKey(orderNumber, customization.itemCode);
        if (key) {
          localStorage.removeItem(key);
        }
      });
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
      setError(
        confirmError.response?.data?.message || "Unable to confirm this order."
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 px-3 py-4 md:px-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
                  disabled={Boolean(stockIssueMessage) || confirming || loading}
                  className="bg-afmc-maroon px-4 py-2 text-white ring-1 ring-afmc-gold/30 hover:bg-afmc-maroon/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {confirming ? toInitCap("Confirming...") : toInitCap("Confirm")}
                </ActionButton>

                <ActionButton
                  onClick={handleCancelOrder}
                  disabled={cancelling || loading}
                  className="bg-white/10 px-4 py-2 text-white shadow-sm ring-1 ring-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {cancelling ? toInitCap("Cancelling...") : toInitCap("Cancel")}
                </ActionButton>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid gap-3 border-t border-stone-200 bg-white p-4 md:grid-cols-3">
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

            <div className="rounded-xl border border-afmc-gold/20 bg-gradient-to-br from-white to-afmc-gold/5 p-3">
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
              {stockIssueMessage ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {stockIssueMessage}
                </div>
              ) : null}
              {/* Products */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items
                  .filter((item) => Number(item.quantity || 0) > 0)
                  .map((item) => (
                    <div
                      key={item.orderLineId ?? item.id}
                      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-afmc-gold/40 hover:shadow-md focus-within:ring-2 focus-within:ring-afmc-gold/40 focus-within:ring-offset-2 focus-within:ring-offset-stone-50"
                    >
                      {/* Image */}
                      <div className="flex h-40 items-center justify-center bg-stone-50 p-4">
                        <img
                          src={`${BASEAPI}${item.image || "default.jpg"}`}
                          alt={item.item_name}
                          className="max-h-full w-auto object-contain transition duration-300 group-hover:scale-[1.03]"
                        />
                      </div>

                      {/* Details */}
                      <div className="space-y-3 p-4">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="line-clamp-1 text-base font-semibold text-stone-900">
                              {toInitCap(item.item_name)}
                            </h3>
                            {!disableEdit && !hideCocktailEdit && isCocktailOrMocktail(item) && !item.isFreeItem ? (
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
                            {item.isFreeItem ? (
                              <span className="ml-1 rounded-full bg-afmc-gold/10 px-2 py-0.5 text-[11px] font-semibold text-afmc-maroon">
                                {toInitCap("Free")}
                              </span>
                            ) : null}
                          </p>
                          {isCocktailOrMocktail(item) && (() => {
                            const itemCode = String(item?.item_code || "").trim();
                            const override = itemCode ? cocktailOverrideIssues?.[itemCode] : null;
                            const statusText = override?.hasDetails
                              ? (override.isOutOfStock ? "Out Of Stock" : "In Stock")
                              : (item.stockStatus || "");

                            if (!statusText) return null;

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
                            if (!details || details.length === 0) return null;

                            return (
                              <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-700">
                                <p className="mb-1 font-semibold text-stone-800">Ingredients</p>
                                <ul className="space-y-0.5">
                                  {details.slice(0, 6).map((ing, idx) => (
                                    <li key={`${ing.ITEM_CODE || ing.itemCode || idx}`} className="flex justify-between gap-2">
                                      <span className="truncate">{ing.ITEM_NAME || ing.itemName || "Item"}</span>
                                      <span className="shrink-0 text-stone-600">
                                        {Number(ing.PEGS ?? ing.pegs ?? ing.QUANTITY ?? ing.quantity ?? 0) || 0}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {details.length > 6 ? (
                                  <p className="mt-1 text-[11px] text-stone-500">+{details.length - 6} moreΓÇª</p>
                                ) : null}
                              </div>
                            );
                          })()}
                          {!isCocktailOrMocktail(item) && !item.isFreeItem && item.availableQuantity !== null && item.availableQuantity !== undefined && (
                            <p className="mt-1 text-xs text-stone-400">
                              Available: {item.availableQuantity}
                            </p>
                          )}
                          {!isCocktailOrMocktail(item) &&
                            !item.isFreeItem &&
                            item.availableQuantity !== null &&
                            item.availableQuantity !== undefined &&
                            Number(item.quantity || 0) > Number(item.availableQuantity || 0) && (
                              <p className="mt-1 text-xs font-semibold text-red-600">
                                Out of stock for this quantity
                              </p>
                            )}
                        </div>

                        {/* Controls */}
                        {!item.isFreeItem ? (
                          <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQtyClick(item, -1)}
                                aria-disabled={disableEdit || updatingLineId === Number(item.orderLineId ?? item.id) || item.quantity <= 1}
                                disabled={disableEdit || updatingLineId === Number(item.orderLineId ?? item.id) || item.quantity <= 1}
                                className={`rounded-md bg-white p-1.5 text-stone-700 shadow-sm transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 ${updatingLineId === Number(item.orderLineId ?? item.id) || item.quantity <= 1
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
                                  disableEdit ||
                                  updatingLineId === Number(item.orderLineId ?? item.id) ||
                                  (() => {
                                    const override = getCocktailOverrideForItem(item);
                                    if (override) return Boolean(override.isOutOfStock);
                                    return String(item.stockIssueMessage || "").trim().length > 0 || isOutOfStock(item);
                                  })() ||
                                  (() => {
                                    if (isCocktailOrMocktail(item)) return false;
                                    const maxAllowed = getMaxAllowedQuantity(item);
                                    return (
                                      Number.isFinite(Number(maxAllowed)) &&
                                      Number(maxAllowed) >= 0 &&
                                      Number(item.quantity || 0) >= Number(maxAllowed)
                                    );
                                  })() ||
                                  item.quantity >= MAX_QTY
                                }
                                disabled={
                                  disableEdit ||
                                  updatingLineId === Number(item.orderLineId ?? item.id) ||
                                  (() => {
                                    const override = getCocktailOverrideForItem(item);
                                    if (override) return Boolean(override.isOutOfStock);
                                    return String(item.stockIssueMessage || "").trim().length > 0 || isOutOfStock(item);
                                  })() ||
                                  (() => {
                                    if (isCocktailOrMocktail(item)) return false;
                                    const maxAllowed = getMaxAllowedQuantity(item);
                                    return (
                                      Number.isFinite(Number(maxAllowed)) &&
                                      Number(maxAllowed) >= 0 &&
                                      Number(item.quantity || 0) >= Number(maxAllowed)
                                    );
                                  })() ||
                                  item.quantity >= MAX_QTY
                                }
                                className={`rounded-md bg-afmc-maroon p-1.5 text-white shadow-sm transition hover:bg-afmc-maroon2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 ${updatingLineId === Number(item.orderLineId ?? item.id) ||
                                  (() => {
                                    const override = getCocktailOverrideForItem(item);
                                    if (override) return Boolean(override.isOutOfStock);
                                    return String(item.stockIssueMessage || "").trim().length > 0 || isOutOfStock(item);
                                  })() ||
                                  (() => {
                                    if (isCocktailOrMocktail(item)) return false;
                                    const maxAllowed = getMaxAllowedQuantity(item);
                                    return (
                                      Number.isFinite(Number(maxAllowed)) &&
                                      Number(maxAllowed) >= 0 &&
                                      Number(item.quantity || 0) >= Number(maxAllowed)
                                    );
                                  })() ||
                                  item.quantity >= MAX_QTY
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
                        ) : (
                          <div className="rounded-xl bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600">
                            Free item
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>


            </div>
          )}
        </div>
      </div>
    </div>
  );
}
