import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, Minus, Plus, ShoppingCart, Trash2, XCircle } from "lucide-react";
import Pubmenubuyservice from "../../services/Pubmenubuyservice";

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

  return {
    id: item.item_id || item.ITEM_ID || item.item_code || item.ITEM_CODE || fallbackIndex,
    item_code: item.item_code || item.ITEM_CODE || "",
    item_name: item.item_name || item.ITEM_NAME || parsed.item_name,
    quantity: Number(item.quantity || item.QUANTITY || parsed.quantity || 1),
    subtotal: Number(item.subtotal || item.SUBTOTAL || item.unit_price || item.UNIT_PRICE || 0),
    image: item.image || item.IMAGE || "",
    card_text: item.card_text || item.CARD_TEXT || "",
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
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function Pubmenubuy() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  console.log("orderNumber",orderNumber);
  const [items, setItems] = useState(() =>
    fallbackItemFromState(location.state?.item).map((item, index) => normalizeItem(item, index))
  );
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [error, setError] = useState("");

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
        console.log("orderNumber1",orderNumber)
        const rows = Array.isArray(response?.data?.data) ? response.data.data : [];
        if (!ignore) {
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

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
    [items]
  );

  const adjustQuantity = (id, delta) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, Number(item.quantity || 1) + delta) }
          : item
      )
    );
  };

  const removeItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#f6f2ee] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-5">
        <div className="rounded-3xl border border-stone-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 border-b border-stone-200 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <h1 className="text-2xl font-semibold text-stone-900">order details</h1>

            <div className="flex flex-wrap gap-3">
              <ActionButton
                onClick={() => navigate(-1)}
                className="bg-[#7f766f] hover:bg-[#6f665f]"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </ActionButton>
              <ActionButton className="bg-[#6f9d24] hover:bg-[#618a1f]">
                <CheckCircle2 className="h-4 w-4" />
                Confirm Order
              </ActionButton>
              <ActionButton className="bg-[#f0261e] hover:bg-[#d91d17]">
                <XCircle className="h-4 w-4" />
                Cancel Order
              </ActionButton>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-6 md:grid-cols-2 md:px-6">
            <div className="rounded-md border border-dashed border-stone-400 px-3 py-2">
              <div className="text-sm text-stone-600">Order Number</div>
              <div className="text-3xl font-medium text-stone-900">
                {orderNumber }
              </div>
            </div>
            <div className="rounded-md border border-dashed border-stone-400 px-3 py-2">
              <div className="text-sm text-stone-600">Order Date</div>
              <div className="text-3xl font-medium text-stone-900">{formatDate()}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          {loading ? (
            <div className="py-16 text-center text-stone-500">Loading order details...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-stone-500">No items found for this order.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                  >
                    <div className="flex h-48 items-center justify-center border-b border-stone-100 bg-stone-50 p-6">
                      <img
                        src={`${BASEAPI}${item.image || "default.jpg"}`}
                        alt={item.item_name}
                        className="max-h-full w-auto object-contain"
                      />
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="text-lg text-stone-900">
                        <div>Name: {item.item_name}</div>
                        <div>Quantity: {item.quantity}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-md bg-stone-100 p-2 text-stone-900 transition hover:bg-stone-200"
                          aria-label={`Remove ${item.item_name}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustQuantity(item.id, 1)}
                          className="rounded-md bg-stone-100 p-2 text-stone-900 transition hover:bg-stone-200"
                          aria-label={`Increase ${item.item_name}`}
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustQuantity(item.id, -1)}
                          className="rounded-md bg-stone-100 p-2 text-stone-900 transition hover:bg-stone-200"
                          aria-label={`Decrease ${item.item_name}`}
                        >
                          <Minus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-stone-50 px-5 py-4">
                <div className="inline-flex items-center gap-2 text-stone-700">
                  <ShoppingCart className="h-5 w-5" />
                  Total Items: {items.length}
                </div>
                <div className="text-lg font-semibold text-stone-900">
                  Total Amount: {totalAmount.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
