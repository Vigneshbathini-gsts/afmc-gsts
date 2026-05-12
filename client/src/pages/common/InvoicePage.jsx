import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, CreditCard, ReceiptText } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ConfirmOrderservice from "../../services/ConfirmOrderservice";

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-IN");
  }
  return date.toLocaleDateString("en-IN");
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount.toFixed(2);
}

export default function InvoicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const amountFromQuery = Number(searchParams.get("amount") || location.state?.amount || 0);
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [error, setError] = useState("");
  const [orderData, setOrderData] = useState(null);

  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";

  useEffect(() => {
    let ignore = false;

    const fetchInvoiceOrder = async () => {
      if (!orderNumber) {
        setLoading(false);
        setError("Order number is missing.");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await ConfirmOrderservice.getConfirmedOrder(orderNumber);
        if (!ignore) {
          setOrderData(response?.data?.data || null);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(
            fetchError.response?.data?.message || "Unable to load invoice details."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchInvoiceOrder();
    return () => {
      ignore = true;
    };
  }, [orderNumber]);

  const items = Array.isArray(orderData?.items) ? orderData.items : [];
  const computedAmount = Number(orderData?.header?.order_total || amountFromQuery || 0);
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  return (
    <div className="min-h-screen bg-[#f5f1ec] px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <div className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex justify-between gap-3 px-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-[#6b0f1a] transition hover:bg-stone-100"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white">
              <CreditCard className="h-4 w-4" />
              Payment Ready
            </div>
          </div>

          <div className="relative px-6 pb-8 pt-5">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#d4af37]/30 bg-[#fff8eb]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6b0f1a] text-white">
                <ReceiptText className="h-6 w-6" />
              </div>
            </div>

            <h1 className="mt-5 text-center text-3xl font-bold tracking-tight text-[#6b0f1a]">
              Invoice Summary
            </h1>

            <p className="mt-2 text-center text-sm text-stone-500">
              Review your completed order before continuing with payment.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-[#d4af37]/30 bg-[#fff8eb] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Order Number
                </p>
                <p className="mt-2 text-2xl font-bold text-stone-900">
                  {orderData?.header?.order_num || orderNumber}
                </p>
              </div>

              <div className="rounded-3xl border border-[#d4af37]/30 bg-[#fff8eb] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Order Date
                </p>
                <p className="mt-2 text-2xl font-bold text-stone-900">
                  {formatDate(orderData?.header?.order_date)}
                </p>
              </div>

              <div className="rounded-3xl border border-[#d4af37]/30 bg-[#fff8eb] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Amount
                </p>
                <p className="mt-2 text-2xl font-bold text-[#6b0f1a]">
                  {formatMoney(computedAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between border-b border-stone-200 bg-gradient-to-r from-[#6b0f1a] to-[#8b1e2d] px-5 py-4">
            <h2 className="text-lg font-semibold text-[#f4d28c]">
              Invoice Details
            </h2>

            <div className="text-sm text-[#f8e7bd]/90">
              Items : {items.length}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-stone-500">
              Loading invoice...
            </div>
          ) : error ? (
            <div className="p-5">
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            </div>
          ) : (
            <div className="p-5">
              <div className="overflow-hidden rounded-2xl border border-stone-200">
                <table className="min-w-full">
                  <thead className="bg-[#faf7f2]">
                    <tr>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        Item Name
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        Quantity
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        Total
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
                          {item.item_name}
                        </td>
                        <td className="px-5 py-4 text-sm text-stone-700">
                          {item.quantity}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-stone-900">
                          {formatMoney(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#faf7f2] px-5 py-4 text-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5 text-stone-600">
                  <span>
                    Total Items :
                    <span className="ml-1 font-semibold text-stone-900">
                      {items.length}
                    </span>
                  </span>

                  <span>
                    Quantity :
                    <span className="ml-1 font-semibold text-stone-900">
                      {totalQuantity}
                    </span>
                  </span>
                </div>

                <div className="rounded-full bg-[#6b0f1a] px-5 py-2 text-sm font-semibold text-white">
                  Payable Amount : {formatMoney(computedAmount)}
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `${currentBasePath}/payment?orderNumber=${encodeURIComponent(orderData?.header?.order_num || orderNumber)}&amount=${encodeURIComponent(formatMoney(computedAmount))}`,
                      {
                        state: {
                          orderNumber: orderData?.header?.order_num || orderNumber,
                          amount: computedAmount,
                        },
                      }
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-[#6b0f1a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#58101a]"
                >
                  <CreditCard className="h-4 w-4" />
                  Continue To Payment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
