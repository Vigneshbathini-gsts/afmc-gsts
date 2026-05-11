import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import ConfirmOrderservice from "../../services/ConfirmOrderservice";

function statusColor(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "text-green-700";
  if (normalized === "preparing") return "text-amber-700";
  if (normalized === "cancelled") return "text-red-700";
  return "text-blue-700";
}

export default function InvoicePage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!orderNumber) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await ConfirmOrderservice.getConfirmedOrder(orderNumber);
        const payload = response?.data?.data || null;
        if (!ignore) setData(payload);
      } catch (err) {
        if (!ignore) {
          setError(err?.response?.data?.message || "Unable to load invoice.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [orderNumber]);

  const header = data?.header || {};
  const items = Array.isArray(data?.items) ? data.items : [];
  const orderStatus = header?.status || "Received";

  const totalQty = useMemo(
    () => items.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [items]
  );

  return (
    <div className="min-h-screen bg-stone-50 px-3 py-4 md:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-red-600">Thank you for the order.</h2>
            <h3 className={`text-lg font-semibold ${statusColor(orderStatus)}`}>
              {orderStatus}. Your Order
            </h3>
          </div>

          {loading && <p className="mt-4 text-sm text-stone-600">Loading…</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {!loading && !error && orderNumber && (
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <span className="font-semibold">Order Number:</span> {header.order_num || orderNumber}
                </div>
                <div>
                  <span className="font-semibold">Order Date:</span>{" "}
                  {header.order_date ? new Date(header.order_date).toLocaleString("en-IN") : "-"}
                </div>
                {header.customer_name != null && (
                  <div className="sm:col-span-2">
                    <span className="font-semibold">Customer:</span> {header.customer_name || "-"}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-stone-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, idx) => (
                      <tr key={`${row.item_id || idx}-${idx}`} className="border-t border-stone-200">
                        <td className="px-3 py-2">{row.item_name || row.item_id}</td>
                        <td className="px-3 py-2 text-right">{row.quantity}</td>
                        <td className="px-3 py-2">{row.status || "Received"}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr className="border-t border-stone-200">
                        <td className="px-3 py-4 text-center text-stone-500" colSpan={3}>
                          No items found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between text-sm">
                <div>
                  <span className="font-semibold">Total Items:</span> {items.length}
                </div>
                <div>
                  <span className="font-semibold">Total Qty:</span> {totalQty}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

