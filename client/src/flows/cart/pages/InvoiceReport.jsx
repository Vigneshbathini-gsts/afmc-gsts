import React, { useEffect, useMemo, useState } from "react";
import { ChevronsLeft, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import InvoiceReportservice from "../../../services/InvoiceReportservice";
import { toInitCap } from "../../../utils/textFormat";

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

export default function InvoiceReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(Boolean(searchParams.get("orderNumber") || location.state?.orderNumber));
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(location.state?.invoiceData || null);
  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const amountFromQuery = Number(searchParams.get("amount") || location.state?.amount || 0);
  const items = Array.isArray(reportData?.items) ? reportData.items : [];
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );
  const resolvedAmount = Number(
    reportData?.summary?.total_amount ||
      reportData?.header?.invoice_amount ||
      reportData?.header?.order_total ||
      amountFromQuery ||
      0
  );

  useEffect(() => {
    // Ensure browser Back from invoice report returns to menu dashboard.
    const handler = () => {
      navigate(`${currentBasePath}/menudash`, { replace: true });
    };

    try {
      window.history.pushState({ afmcInvoiceReportTrap: true }, "", window.location.href);
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

    const fetchInvoiceReport = async () => {
      if (!orderNumber) {
        setLoading(false);
        setError("Order number is missing.");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await InvoiceReportservice.getByOrderNumber(orderNumber);
        if (!ignore) {
          setReportData(response?.data?.data || null);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(
            fetchError.response?.data?.message || "Unable to load invoice report."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchInvoiceReport();

    return () => {
      ignore = true;
    };
  }, [orderNumber]);

  return (
    <div className="overflow-hidden rounded-[32px] border border-white/40 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] transition-all duration-300">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <div className="overflow-hidden rounded-[32px] border border-white/40 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] transition-all duration-300">
          <div className="relative overflow-hidden bg-white px-6 py-5">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_top_right,rgba(212,175,55,0.22),transparent_55%)]" />
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
              className="relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6b0f1a] to-[#8b1322] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6b0f1a]/20 ring-1 ring-[#d4af37]/20 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
            >
              <ChevronsLeft className="h-4 w-4" />
              {toInitCap("Back")}
            </button>
          </div>

          <div className="px-6 pb-10 pt-5 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[#d4af37]/30 bg-gradient-to-br from-[#fff8eb] to-[#fff1cc] shadow-inner">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#6b0f1a] to-[#a5162a] text-white shadow-lg">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-[#6b0f1a]">
              {toInitCap("Thank You for the order.")}
            </h1>

            <p className="mt-3 inline-flex items-center justify-center rounded-full bg-[#d4af37]/15 px-5 py-2 text-base font-semibold text-[#6b0f1a] ring-1 ring-[#d4af37]/25">
              {toInitCap("Completed Your Order")}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-white/40 bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.12)] transition-all duration-300">
          <div className="border-b border-[#d4af37]/25 bg-[#fffaf4] px-5 py-4">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#6b0f1a]">
              {toInitCap("Invoice Report")}
            </h2>
          </div>

          <div className="p-5">
            <div className="mx-auto max-w-md space-y-5 rounded-[26px] bg-gradient-to-b from-[#fffaf4] to-white px-6 py-8 text-center ring-1 ring-[#d4af37]/20">
              <div className="flex justify-between text-sm text-stone-600">
                <span>{toInitCap("Invoice Id")} :</span>
                <span className="font-semibold text-stone-900">
                  {reportData?.header?.invoice_id || "-"}
                </span>
              </div>

              <div className="flex justify-between text-sm text-stone-600">
                <span>{toInitCap("Order Number")} :</span>
                <span className="font-semibold text-stone-900">{orderNumber}</span>
              </div>

              <div className="flex justify-between text-sm text-stone-600">
                <span>{toInitCap("Invoice Date")} :</span>
                <span className="font-semibold text-stone-900">
                  {formatDate(reportData?.header?.invoice_date || reportData?.header?.order_date)}
                </span>
              </div>

              <div className="flex justify-between text-sm text-stone-600">
                <span>{toInitCap("Amount")} :</span>
                <span className="font-semibold text-stone-900">
                  ₹{formatMoney(resolvedAmount)}
                </span>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-[#d4af37]/25">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-[#fff7ea] to-[#fffaf4]">
                  <tr>
                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      {toInitCap("Item Name")}
                    </th>
                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      {toInitCap("Quantity")}
                    </th>
                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      {toInitCap("Unit Price")}
                    </th>
                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      {toInitCap("Total")}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-200 bg-white">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-8 text-center text-sm text-stone-500"
                      >
                        Loading invoice report...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-8 text-center text-sm text-red-600"
                      >
                        {error}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {items.map((item, index) => (
                        <tr
                          key={`${item.item_id}-${index}`}
                          className={index % 2 === 0 ? "bg-white" : "bg-[#fffdf9]"}
                        >
                          <td className="px-5 py-4 text-sm text-stone-800">{toInitCap(item.item_name)}</td>
                          <td className="px-5 py-4 text-sm text-stone-700">{item.quantity}</td>
                          <td className="px-5 py-4 text-sm text-stone-900">₹{formatMoney(item.price)}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-stone-900">₹{formatMoney(item.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="bg-gradient-to-r from-[#fff7ea] to-[#fffaf4]">
                        <td className="px-5 py-4 text-sm text-stone-800" />
                        <td className="px-5 py-4 text-sm text-stone-700">
                          {reportData?.summary?.total_quantity ?? totalQuantity}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#d11616]">
                          {toInitCap(reportData?.summary?.total_label || "Total")}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#d11616]">
                          ₹{formatMoney(resolvedAmount)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
