import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ReceiptText, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Invoiceservice from "../../../services/Invoiceservice";

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

function getFinalItemPrice(item) {
  const basePrice = Number(item?.price ?? item?.PRICE ?? 0);
  const flag = String(item?.inventory_flag ?? item?.INVENTORY_FLAG ?? "")
    .trim()
    .toUpperCase();
  const categoryId = Number(item?.category_id ?? item?.CATEGORY_ID ?? 0);
  const profit = Number(item?.profit ?? item?.PROFIT ?? 0);
  const preparationCharge = Number(item?.prep_charges ?? item?.PREP_CHARGES ?? 0);

  if (flag !== "Y") return basePrice;
  if (categoryId === 10) return basePrice + (basePrice * profit) / 100;
  if (categoryId === 14) return basePrice + preparationCharge;
  return basePrice;
}

export default function InvoicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const amountFromQuery = Number(searchParams.get("amount") || location.state?.amount || 0);
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invoiceData, setInvoiceData] = useState(null);
  const [paymentMode, setPaymentMode] = useState("Credit");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Un Paid");

  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";
  const normalizedPaymentMode = String(paymentMode || "").trim().toUpperCase();
  const isImmediatePayment = normalizedPaymentMode === "IMMEDIATE";
  const isCreditPayment = normalizedPaymentMode === "CREDIT";

  useEffect(() => {
    // Ensure browser Back from invoice returns to menu dashboard (not stale payment/order pages).
    // We push a trap state and intercept the next back navigation.
    const handler = () => {
      navigate(`${currentBasePath}/menudash`, { replace: true });
    };

    try {
      window.history.pushState({ afmcInvoiceTrap: true }, "", window.location.href);
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

    const fetchInvoiceOrder = async () => {
      if (!orderNumber) {
        setLoading(false);
        setError("Order number is missing.");
        return;
      }

      try {
        setLoading(true);
        setError("");
        setSuccess("");
        const response = await Invoiceservice.getByOrderNumber(orderNumber);
        const data = response?.data?.data || null;

        if (!ignore) {
          setInvoiceData(data);
          setPaymentMode(data?.invoice?.payment_method || "Credit");
          setPaymentReference(data?.invoice?.payment_reference || "");
          setPaymentStatus(data?.invoice?.payment_status || "Un Paid");
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

  useEffect(() => {
    setPaymentStatus(isCreditPayment ? "Un Paid" : "Paid");
  }, [isCreditPayment]);

  const rawItems = Array.isArray(invoiceData?.items) ? invoiceData.items : [];
  const items = rawItems.filter(
    (item) =>
      Number(item?.quantity || item?.QUANTITY || 0) > 0 &&
      String(item?.order_status || "").trim().toUpperCase() !== "CANCELLED"
  );
  const getItemName = (item) =>
    item?.item_name || item?.ITEM_NAME || item?.itemName || "";
  const itemAmount = rawItems.reduce(
    (sum, item) =>
      sum +
      ((String(item?.order_status || "").trim().toUpperCase() === "CANCELLED")
        ? 0
        : Number(item?.SUBTOTAL ?? item?.subtotal ?? 0)),
    0
  );
  const computedAmount = Number(
    invoiceData?.totalAmount ??
      (Array.isArray(invoiceData?.items) ? itemAmount : undefined) ??
      invoiceData?.invoice?.amount ??
      invoiceData?.header?.order_total ??
      amountFromQuery ??
      0
  );
  const totalQuantity = useMemo(
    () =>
      rawItems.reduce(
        (sum, item) =>
          sum +
          ((String(item?.order_status || "").trim().toUpperCase() === "CANCELLED")
            ? 0
            : Number(item.quantity || item.QUANTITY || 0)),
        0
      ),
    [rawItems]
  );

  const handleComplete = () => {
    navigate(
      `${currentBasePath}/Buyflowinvoicereport?orderNumber=${encodeURIComponent(orderNumber)}&amount=${encodeURIComponent(formatMoney(computedAmount))}`,
      {
        replace: true,
        state: {
          orderNumber,
          amount: computedAmount,
          invoiceData,
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between px-4 pt-4">
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem("afmc:historyTrap:menudash", "1");
                  sessionStorage.setItem("afmc:guardBack:menudash", "1");
                } catch (_) {
                  // ignore
                }
                navigate(`${currentBasePath}/menudash`, { replace: true });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-afmc-maroon transition hover:bg-stone-100"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <div className="rounded-full bg-[#edf7ef] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Invoice Stage
            </div>
          </div>

          <div className="px-6 pb-8 pt-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-afmc-gold/25 bg-afmc-gold/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-afmc-maroon text-white">
                <ReceiptText className="h-6 w-6" />
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-afmc-maroon">
              Payment Details
            </h1>

            <p className="mt-2 text-sm text-stone-500">
              Review your completed order and finish the invoice details.
            </p>

            <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-afmc-gold/25 bg-afmc-gold/10 px-5 py-3 text-sm">
              <span className="text-stone-500">
                Order No :
                <span className="ml-1 font-semibold text-stone-900">
                  {invoiceData?.header?.order_num || orderNumber}
                </span>
              </span>

              <span className="hidden text-stone-300 md:block">|</span>

              <span className="text-stone-500">
                Date :
                <span className="ml-1 font-semibold text-stone-900">
                  {formatDate(invoiceData?.header?.order_date)}
                </span>
              </span>

              <span className="hidden text-stone-300 md:block">|</span>

              {/* <span className="text-stone-500">
                Amount :
                <span className="ml-1 font-semibold text-stone-900">
                  {formatMoney(computedAmount)}
                </span>
              </span> */}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            <div className="border-b border-stone-200 bg-gradient-to-r from-afmc-maroon to-afmc-maroon/85 px-5 py-4">
              <h2 className="text-lg font-semibold text-afmc-gold">
                Payment Panel
              </h2>
            </div>

            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Payment Mode
                </span>
                <select
                  value={paymentMode}
                  onChange={(event) => setPaymentMode(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/15"
                >
                  <option value="Credit">Credit</option>
                  <option value="Immediate">Immediate</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Payment Reference ID
                </span>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Enter payment reference"
                  disabled={isCreditPayment}
                  className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/15 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Payment Status
                </span>
                <input
                  type="text"
                  value={paymentStatus}
                  readOnly
                  disabled={isImmediatePayment}
                  className="h-12 w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 text-sm font-medium text-stone-700 outline-none disabled:cursor-not-allowed"
                />
              </label>

              {isImmediatePayment ? (
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Scanner
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                    <img
                      src="/images/AFMC_SCANNER.jpg"
                      alt="AFMC Scanner"
                      className="h-56 w-full object-contain"
                    />
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                {/* <button
                  type="button"
                  onClick={handleSaveInvoice}
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-full border border-[#6b0f1a] bg-white px-6 py-3 text-sm font-semibold text-[#6b0f1a] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </button> */}

                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full bg-afmc-maroon px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-afmc-gold/25 transition hover:bg-afmc-maroon/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Complete
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between border-b border-stone-200 bg-gradient-to-r from-afmc-maroon to-afmc-maroon/85 px-5 py-4">
              <h2 className="text-lg font-semibold text-afmc-gold">
                Invoice Preview
              </h2>

              <div className="text-sm text-white/80">
                Items : {items.length}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-stone-500">
                Loading invoice...
              </div>
            ) : (
              <div className="p-5">
                <div className="overflow-hidden rounded-2xl border border-stone-200">
                  <table className="min-w-full">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-sm font-semibold text-afmc-maroon">
                          Item Name
                        </th>
                        <th className="px-5 py-3 text-left text-sm font-semibold text-afmc-maroon">
                          Quantity
                        </th>
                        <th className="px-5 py-3 text-left text-sm font-semibold text-afmc-maroon">
                          Price
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-stone-200 bg-white">
                      {items.map((item, index) => (
                        <tr
                          key={`${item.item_id}-${index}`}
                          className="transition hover:bg-afmc-gold/5"
                        >
                          <td className="px-5 py-4 text-sm font-medium text-stone-800">
                            {getItemName(item)}
                          </td>
                          <td className="px-5 py-4 text-sm text-stone-700">
                            {item.quantity}
                          </td>
                          <td className="px-5 py-4 text-sm text-stone-700">
                            ₹{formatMoney(getFinalItemPrice(item))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-stone-50 px-5 py-4 text-sm md:flex-row md:items-center md:justify-between">
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

                  {/* <div className="rounded-full bg-[#edf7ef] px-5 py-2 text-sm font-semibold text-emerald-700">
                    Payable Amount : {formatMoney(computedAmount)}
                  </div> */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
