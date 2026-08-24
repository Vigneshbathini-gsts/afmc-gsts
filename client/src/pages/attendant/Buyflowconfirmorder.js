import React, { useEffect, useMemo, useState } from "react";
import { ChevronsLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ConfirmOrderservice from "../../services/ConfirmOrderservice";
import { API_BASE_URL } from "../../services/api";
import { getToken } from "../../utils/authStorage";
import { toInitCap } from "../../utils/textFormat";


function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-IN");
  }
  return date.toLocaleDateString("en-IN");
}

export default function Buyflowconfirmorder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [error, setError] = useState("");
  const [orderData, setOrderData] = useState(null);

  // Auto-clear error warnings after 5 seconds for better UX
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";

  useEffect(() => {
    // Ensure browser Back from confirm order does not return to /menudash/buy (stale buy screen).
    const handler = () => {
      navigate(`${currentBasePath}/menudash`, { replace: true });
    };

    try {
      window.history.pushState({ afmcConfirmTrap: true }, "", window.location.href);
      window.addEventListener("popstate", handler);
    } catch (_) {
      // ignore
    }

    return () => {
      try {
        window.removeEventListener("popstate", handler);
      } catch (_) {
        // ignore
      }
    };
  }, [currentBasePath, navigate]);

  useEffect(() => {
    let ignore = false;
    let eventSource;

    const fetchConfirmedOrder = async ({ silent = false } = {}) => {
      if (!orderNumber) {
        setLoading(false);
        setError("Order number is missing.");
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setError("");
        const response = await ConfirmOrderservice.getConfirmedOrder(orderNumber);
        if (!ignore) {
          setOrderData(response?.data?.data || null);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(
            fetchError.response?.data?.message || "Unable to load confirmed order details."
          );
        }
      } finally {
        if (!ignore && !silent) {
          setLoading(false);
        }
      }
    };

    fetchConfirmedOrder();

    const token = getToken();
    if (typeof window !== "undefined" && typeof window.EventSource !== "undefined" && token) {
      eventSource = new window.EventSource(
        `${API_BASE_URL}/order-events?token=${encodeURIComponent(token)}`,
        { withCredentials: true }
      );

      const handleStatusEvent = (event) => {
        if (ignore) return;

        try {
          const payload = JSON.parse(event.data || "{}");
          if (String(payload.orderNumber || "") !== String(orderNumber)) {
            return;
          }

          fetchConfirmedOrder({ silent: true });
        } catch (streamError) {
          console.error("Unable to process order status stream event:", streamError);
        }
      };

      eventSource.addEventListener("order-status-updated", handleStatusEvent);
      eventSource.addEventListener("message", handleStatusEvent);

      eventSource.onerror = () => {
        if (!ignore) {
          console.warn("Order status event stream disconnected");
        }
      };
    }

    return () => {
      ignore = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [orderNumber]);

  const items = useMemo(
    () => (Array.isArray(orderData?.items) ? orderData.items : []),
    [orderData?.items]
  );

  const orderStatus = String(orderData?.header?.status || "Received");
  const paymentStatus = String(orderData?.header?.payment_status || "Not Paid");
  const canProceedToPayment = orderStatus === "Completed" && paymentStatus !== "Paid";
  const isPaymentDone = paymentStatus === "Paid";
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
    [items]
  );

return (
  <div className="min-h-screen bg-[#f5f1ec] px-4 py-5 md:px-8">
    <div className="mx-auto max-w-[1180px] space-y-5">
      {/* Success Banner */}
      <div className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        {/* Top Action */}
        <div className="flex justify-end gap-3 px-4 pt-4">
          {canProceedToPayment ? (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `${currentBasePath}/payment?orderNumber=${encodeURIComponent(orderData?.header?.order_num || orderNumber)}`,
                  {
                    state: {
                      orderNumber: orderData?.header?.order_num || orderNumber,
                    },
                  }
                )
              }
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Go to Payment
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem("afmc:guardBack:menudash", "1");
              } catch (_) {
                // ignore
              }
              navigate(`${currentBasePath}/menudash`, { replace: true });
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[#6b0f1a] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#58101a]"
          >
            <ChevronsLeft className="h-4 w-4" />
            {toInitCap("Back")}
          </button>
        </div>

        {/* Content */}
        <div className="relative px-6 pb-10 pt-5 text-center">
          {/* Decorative Ring */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#d4af37]/30 bg-[#fff8eb]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6b0f1a] text-white">
              ✓
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#6b0f1a]">
            {toInitCap("Thank You for Your Order")}
          </h1>

          <p className="mt-2 text-sm text-stone-500">
            {toInitCap("Your order has been received successfully.")}
          </p>

          <div className="mt-4 rounded-2xl border border-stone-200 bg-[#fff4f0] px-4 py-4 text-center text-sm text-stone-700">
            {orderStatus === "Completed" && paymentStatus === "Paid" ? (
              <p>
                {toInitCap("Payment has been completed. Here is your invoice.")}
              </p>
            ) : orderStatus === "Completed" ? (
              <p>
                {toInitCap("Kitchen has completed all items. You can now proceed to payment.")}
              </p>
            ) : orderStatus === "Cancelled" ? (
              <p>
                {toInitCap("The order has been cancelled by the kitchen. Please contact support for details.")}
              </p>
            ) : (
              <p>
                {toInitCap("The order is currently")} <strong>{toInitCap(orderStatus)}</strong>.{" "}
                {toInitCap("Payment will be available once all items have been completed.")}
              </p>
            )}
          </div>

          {/* Compact Order Details */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-[#d4af37]/30 bg-[#fff8eb] px-5 py-3 text-sm">
            <span className="text-stone-500">
              Order No :
              <span className="ml-1 font-semibold text-stone-900">
                {orderData?.header?.order_num || orderNumber}
              </span>
            </span>

            <span className="hidden text-stone-300 md:block">|</span>

            <span className="text-stone-500">
              Date :
              <span className="ml-1 font-semibold text-stone-900">
                {formatDate(orderData?.header?.order_date)}
              </span>
            </span>

            <span className="hidden text-stone-300 md:block">|</span>

            {/* <span className="text-stone-500">
              Amount :
              <span className="ml-1 font-semibold text-stone-900">
                {orderAmount.toFixed(2)}
              </span>
            </span> */}

            <span className="hidden text-stone-300 md:block">|</span>

            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              {toInitCap(orderStatus)}
            </span>
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-gradient-to-r from-[#6b0f1a] to-[#8b1e2d] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#f4d28c]">
            {toInitCap("Invoice Report")}
          </h2>

          <div className="text-sm text-[#f8e7bd]/90">
            {toInitCap("Items")} : {items.length}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-stone-500">
            {toInitCap("Loading confirmed order...")}
          </div>
        ) : error ? (
          <div className="p-5">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          </div>
        ) : (
          <div className="p-5">
            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="min-w-full">
                <thead className="bg-[#faf7f2]">
                  <tr>
                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      {toInitCap("Item Name")}
                    </th>

                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      {toInitCap("Quantity")}
                    </th>

                    {isPaymentDone && (
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        {toInitCap("Subtotal")}
                      </th>
                    )}

                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      {toInitCap("Status")}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-200 bg-white">
                  {items.map((item, index) => (
                    <tr
                      key={`${item.item_id}-${index}`}
                      className="transition hover:bg-[#fffdf9]"
                    >
                      <td className="px-5 py-4 text-sm font-medium text-stone-800">
                        {toInitCap(item.item_name)}
                      </td>

                      <td className="px-5 py-4 text-sm text-stone-700">
                        {item.quantity}
                      </td>

                      {isPaymentDone && (
                        <td className="px-5 py-4 text-sm text-stone-700">
                          ₹{Number(item.subtotal || 0).toFixed(2)}
                        </td>
                      )}

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          {toInitCap(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#faf7f2] px-5 py-4 text-sm md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-5 text-stone-600">
                <span>
                  {toInitCap("Total Items")} :
                  <span className="ml-1 font-semibold text-stone-900">
                    {items.length}
                  </span>
                </span>

                <span>
                  {toInitCap("Quantity")} :
                  <span className="ml-1 font-semibold text-stone-900">
                    {totalQuantity}
                  </span>
                </span>

                {isPaymentDone && (
                  <span>
                    {toInitCap("Total Amount")} :
                    <span className="ml-1 font-semibold text-stone-900">
                      ₹{totalAmount.toFixed(2)}
                    </span>
                  </span>
                )}
              </div>

              {/* <button
                type="button"
                onClick={() => navigate(`${currentBasePath}/menudash`)}
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-[#6b0f1a] transition hover:bg-stone-100"
              >
                <ChevronLeft className="h-4 w-4" />
                {toInitCap("Go Back")}
              </button> */}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
