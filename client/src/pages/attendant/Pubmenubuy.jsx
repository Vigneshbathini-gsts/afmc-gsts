import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, Minus, Plus, Trash2, XCircle } from "lucide-react";
import Pubmenubuyservice from "../../services/Pubmenubuyservice";
import ConfirmOrderservice from "../../services/ConfirmOrderservice";

const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

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
  const rawPrice = item.price ?? item.PRICE;
  const isFreeItem = rawPrice === 0 || String(rawPrice) === "0";

  return {
    id: item.order_line_id || item.ORDER_LINE_ID || item.item_id || item.ITEM_ID || fallbackIndex,
    order_line_id: item.order_line_id || item.ORDER_LINE_ID || null,
    item_code: item.item_code || item.ITEM_CODE || "",
    item_name: item.item_name || item.ITEM_NAME || parsed.item_name,
    quantity: Number(item.quantity || item.QUANTITY || parsed.quantity || 1),
    subtotal: Number(item.subtotal || item.SUBTOTAL || item.unit_price || item.UNIT_PRICE || 0),
    image: item.image || item.IMAGE || "",
    card_text: item.card_text || item.CARD_TEXT || "",
    price: rawPrice,
    barcode: item.barcode || item.BARCODE || null,
    isFreeItem,
  };
}

function ActionButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function Pubmenubuy({ backTo = "" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const [items, setItems] = useState([]);
  const [orderHeader, setOrderHeader] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [updatingItemCode, setUpdatingItemCode] = useState(null);
  const [error, setError] = useState("");
  const [itemError, setItemError] = useState({ itemCode: null, message: "" });
  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";

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
        console.log("Fetched order details:", data);
        const rows = Array.isArray(data?.items) ? data.items : [];
        if (!ignore) {
          setItemError({ itemCode: null, message: "" });
          setOrderHeader(data?.header || null);
          setItems(rows.map((item, index) => normalizeItem(item, index)));
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

  const syncFromSummary = (payload) => {
    const data = payload?.data || payload || {};
    const rows = Array.isArray(data?.items) ? data.items : [];
    setItemError({ itemCode: null, message: "" });
    setOrderHeader(data?.header || null);
    setItems(rows.map((item, index) => normalizeItem(item, index)));
  };

  const adjustQuantity = async (item, delta) => {
    if (!orderNumber || !item?.item_code || item?.isFreeItem || updatingItemCode) {
      return;
    }

    try {
      setUpdatingItemCode(String(item.item_code));
      setError("");
      setItemError({ itemCode: null, message: "" });
      const response = await Pubmenubuyservice.updateItemQuantity(orderNumber, item.item_code, delta);
      syncFromSummary(response?.data);
    } catch (updateError) {
      const message = updateError.response?.data?.message || "Unable to update quantity.";
      if (message.toLowerCase().includes("out of stock")) {
        setItemError({ itemCode: String(item.item_code), message });
      } else {
        setError(message);
      }
    } finally {
      setUpdatingItemCode(null);
    }
  };

  const removeItem = async (item) => {
    if (!orderNumber || !item?.item_code || item?.isFreeItem || updatingItemCode) {
      return;
    }

    try {
      setUpdatingItemCode(String(item.item_code));
      setError("");
      setItemError({ itemCode: null, message: "" });
      await Pubmenubuyservice.deleteItem(orderNumber, item.item_code);

      try {
        const summaryResponse = await Pubmenubuyservice.getByOrderNumber(orderNumber);
        syncFromSummary(summaryResponse?.data);
      } catch (summaryError) {
        if (summaryError?.response?.status === 404) {
          navigate(location.pathname.replace(/\/buy$/, ""), { replace: true });
          return;
        }

        throw summaryError;
      }
    } catch (removeError) {
      if (removeError?.response?.status === 404) {
        navigate(location.pathname.replace(/\/buy$/, ""), { replace: true });
        return;
      }

      setError(removeError.response?.data?.message || "Unable to remove item.");
    } finally {
      setUpdatingItemCode(null);
    }
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
    if (!orderNumber || confirming || loading) {
      return;
    }

    try {
      setConfirming(true);
      setError("");
      await ConfirmOrderservice.confirmOrder(orderNumber);
      navigate(`${currentBasePath}/Buyflowconfirmorder?orderNumber=${orderNumber}`);
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
     <div className="mx-auto max-w-[1180px] space-y-4">
        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-afmc-gold/20 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
        <div className="bg-afmc-maroon px-5 py-5 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/80">
                Order Details
              </p>
 
            </div>
 
            <div className="flex flex-wrap gap-2">
              <ActionButton
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className="bg-white/15 px-4 py-2 hover:bg-white/25"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </ActionButton>
 
              <ActionButton
                onClick={handleConfirmOrder}
                disabled={confirming || loading}
                 className="bg-afmc-maroon px-4 py-2 text-white shadow-sm hover:bg-afmc-maroon/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirming ? "Confirming..." : "Confirm"}
              </ActionButton>

              <ActionButton
                onClick={handleCancelOrder}
                disabled={cancelling || loading}
                className="bg-white/10 px-4 py-2 text-white shadow-sm ring-1 ring-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" />
                {cancelling ? "Cancelling..." : "Cancel"}
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-3 border-t border-stone-200 bg-white p-4 md:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">Order Number</p>

            <h3 className="mt-1 text-xl font-semibold text-stone-900">
              {orderHeader?.order_num || orderNumber}
            </h3>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-500">Order Date</p>

            <h3 className="mt-1 text-xl font-semibold text-stone-900">
              {formatDate(orderHeader?.order_date)}
            </h3>
          </div>

          
        </div>
      </div>

       {/* Content */}
       <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
         {loading ? (
           <div className="py-16 text-center text-sm text-stone-500">
             Loading order details...
           </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-stone-500">
            No items found for this order.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Products */}
             <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => {
                  const isBusy = updatingItemCode === String(item.item_code);
                  const disableItemActions = Boolean(isBusy || item.isFreeItem);
                  const showItemError =
                    itemError.itemCode === String(item.item_code) && itemError.message;

                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {/* Image */}
                      <div className="relative flex h-40 items-center justify-center bg-stone-50 p-4">
                        <img
                          src={`${BASEAPI}${item.image || "default.jpg"}`}
                          alt={item.item_name}
                          className="max-h-full w-auto object-contain"
                        />
                        {showItemError ? (
                          <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-red-950/10 p-3">
                            <div className="rounded-lg bg-red-600/95 px-3 py-2 text-center text-xs font-semibold text-white shadow-lg">
                              {itemError.message}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Details */}
                      <div className="space-y-3 p-4">
                        <div>
                          <h3 className="line-clamp-1 text-base font-semibold text-stone-900">
                            {item.item_name}
                          </h3>

                          <p className="mt-1 text-sm text-stone-500">
                            Quantity: {item.quantity}
                          </p>
                          {item.isFreeItem ? (
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">
                              Free Item
                            </p>
                          ) : null}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustQuantity(item, -1)}
                              disabled={disableItemActions || Number(item.quantity || 1) <= 1}
                              className="rounded-md bg-white p-1.5 text-stone-700 shadow-sm transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Minus className="h-4 w-4" />
                            </button>

                            <span className="min-w-[28px] text-center text-sm font-semibold text-stone-900">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => adjustQuantity(item, 1)}
                              disabled={disableItemActions}
                              className="rounded-md bg-afmc-maroon p-1.5 text-white transition hover:bg-afmc-maroon2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item)}
                            disabled={disableItemActions}
                            className="rounded-md bg-red-50 p-1.5 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

           
          </div>
        )}
      </div>
    </div>
  </div>
);
}
