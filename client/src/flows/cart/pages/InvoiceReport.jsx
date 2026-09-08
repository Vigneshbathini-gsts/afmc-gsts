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

function getInvoiceItemType(item) {
  const type = String(item?.type ?? item?.TYPE ?? item?.ac_unit ?? item?.AC_UNIT ?? "").trim();
  return !type || type.toUpperCase() === "NA" ? "Nos" : type;
}

function getFinalItemPrice(item) {
  const quantity = Number(item?.quantity ?? item?.QUANTITY ?? 0);
  const basePrice = Number(item?.price ?? item?.PRICE ?? 0);
  const inventoryFlag = String(item?.inventory_flag ?? item?.INVENTORY_FLAG ?? "")
    .trim()
    .toUpperCase();
  const categoryId = Number(item?.category_id ?? item?.CATEGORY_ID ?? item?.subcategory ?? 0);
  const profit = Number(item?.profit ?? item?.PROFIT ?? 0);
  const preparationCharge = Number(
    item?.prep_charges ??
      item?.PREP_CHARGES ??
      item?.food_pr_charges ??
      item?.FOOD_PR_CHARGES ??
      0
  );

  if (inventoryFlag === "N") return basePrice;
  if (inventoryFlag === "Y" && categoryId === 10) {
    return basePrice + (basePrice * profit) / 100;
  }
  if (inventoryFlag === "Y" && categoryId === 14) {
    return basePrice + preparationCharge;
  }

  const lineTotal = Number(item?.subtotal ?? item?.SUBTOTAL ?? 0);
  return quantity > 0 && Number.isFinite(lineTotal) ? lineTotal / quantity : basePrice;
}

export default function InvoiceReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(
    Boolean(searchParams.get("orderNumber") || location.state?.orderNumber)
  );
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(location.state?.invoiceData || null);
  const currentBasePath = location.pathname.startsWith("/attendant") ? "/attendant" : "/user";
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const amountFromQuery = Number(searchParams.get("amount") || location.state?.amount || 0);

  const items = useMemo(
    () =>
      (Array.isArray(reportData?.items) ? reportData.items : []).filter(
        (item) =>
          Number(item?.quantity || item?.QUANTITY || 0) > 0 &&
          String(item?.order_status || "").trim().toUpperCase() !== "CANCELLED"
      ),
    [reportData?.items]
  );

  const totalQuantity = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          ((String(item?.order_status || "").trim().toUpperCase() === "CANCELLED")
            ? 0
            : Number(item.quantity || item.QUANTITY || 0)),
        0
      ),
    [items]
  );

  const calculatedTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + getFinalItemPrice(item) * Number(item.quantity || item.QUANTITY || 0),
        0
      ),
    [items]
  );

  const resolvedAmount = items.length
    ? calculatedTotal
    : Number(
        reportData?.summary?.total_amount ??
          reportData?.header?.invoice_amount ??
          reportData?.header?.order_total ??
          amountFromQuery ??
          0
      );

  const statusText = String(reportData?.header?.status || reportData?.summary?.status || "Completed");

  useEffect(() => {
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
          setError(fetchError.response?.data?.message || "Unable to load invoice report.");
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
    <div className="min-h-screen bg-[#f5f1ec] px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1180px] space-y-5">
        {/* Success Banner (match Buyflowconfirmorder theme) */}
        <div className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex justify-end gap-3 px-4 pt-4">
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

          <div className="relative px-6 pb-10 pt-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#d4af37]/30 bg-[#fff8eb]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6b0f1a] text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#6b0f1a]">
              {toInitCap("Thank You For Your Order")}
            </h1>

            <p className="mt-2 text-sm text-stone-500">
              {toInitCap("Your invoice has been generated successfully.")}
            </p>

            <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-[#d4af37]/30 bg-[#fff8eb] px-5 py-3 text-sm">
              <span className="text-stone-500">
                {toInitCap("Order No")} :
                <span className="ml-1 font-semibold text-stone-900">{orderNumber || "-"}</span>
              </span>

              <span className="hidden text-stone-300 md:block">|</span>

              <span className="text-stone-500">
                {toInitCap("Date")} :
                <span className="ml-1 font-semibold text-stone-900">
                  {formatDate(reportData?.header?.invoice_date || reportData?.header?.order_date)}
                </span>
              </span>

              <span className="hidden text-stone-300 md:block">|</span>

              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                {toInitCap(statusText)}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Report card (match Buyflowconfirmorder theme) */}
        <div className="overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between border-b border-stone-200 bg-gradient-to-r from-[#6b0f1a] to-[#8b1e2d] px-5 py-4">
            <h2 className="text-lg font-semibold text-[#f4d28c]">{toInitCap("Invoice Report")}</h2>
            {/* <div className="text-sm text-[#f8e7bd]/90">
              {toInitCap("Items")} : {items.length}
            </div> */}
          </div>

          {loading ? (
            <div className="py-16 text-center text-stone-500">{toInitCap("Loading invoice report...")}</div>
          ) : error ? (
            <div className="p-5">
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            </div>
          ) : (
            <div className="p-5">
              <div className="mx-auto max-w-md space-y-5 rounded-[26px] bg-[#fffaf4] px-6 py-8 text-center">
                <div className="flex justify-between text-sm text-stone-600">
                  <span>{toInitCap("Invoice ID")} :</span>
                  <span className="font-semibold text-stone-900">{reportData?.header?.invoice_id || "-"}</span>
                </div>

                <div className="flex justify-between text-sm text-stone-600">
                  <span>{toInitCap("Order Number")} :</span>
                  <span className="font-semibold text-stone-900">{orderNumber || "-"}</span>
                </div>

                <div className="flex justify-between text-sm text-stone-600">
                  <span>{toInitCap("Invoice Date")} :</span>
                  <span className="font-semibold text-stone-900">
                    {formatDate(reportData?.header?.invoice_date || reportData?.header?.order_date)}
                  </span>
                </div>

                <div className="flex justify-between text-sm text-stone-600">
                  <span>{toInitCap("Amount")} :</span>
                  <span className="font-semibold text-stone-900">₹{formatMoney(resolvedAmount)}</span>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200">
                <table className="min-w-full">
                  <thead className="bg-[#faf7f2]">
                    <tr>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        {toInitCap("Item Name")}
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        {toInitCap("Quantity")}
                      </th>
                      <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                        {toInitCap("Type")}
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
                    {items.map((item, index) => (
                      <tr key={`${item.item_id}-${index}`} className="transition hover:bg-[#fffdf9]">
                        <td className="px-5 py-4 text-sm text-stone-800">{toInitCap(item.item_name)}</td>
                        <td className="px-5 py-4 text-sm text-stone-700">{item.quantity}</td>
                        <td className="px-5 py-4 text-sm text-stone-700">{getInvoiceItemType(item)}</td>
                        <td className="px-5 py-4 text-sm text-stone-900">
                          ₹{formatMoney(getFinalItemPrice(item))}
                        </td>
                        <td className="px-5 py-4 text-sm text-stone-900">
                          ₹{formatMoney(
                            getFinalItemPrice(item) * Number(item.quantity || item.QUANTITY || 0)
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#fff8eb]">
                      <td className="px-5 py-4 text-sm text-stone-800" />
                      <td className="px-5 py-4 text-sm text-stone-700">
                        {reportData?.summary?.total_quantity ?? totalQuantity}
                      </td>
                      <td className="px-5 py-4 text-sm text-stone-700" />
                      <td className="px-5 py-4 text-sm font-semibold text-[#6b0f1a]">
                        {toInitCap(reportData?.summary?.total_label || "Total")}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#6b0f1a]">
                        ₹{formatMoney(resolvedAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#faf7f2] px-5 py-4 text-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5 text-stone-600">
                  <span>
                    {toInitCap("Total Items")} :
                    <span className="ml-1 font-semibold text-stone-900">{items.length}</span>
                  </span>

                  <span>
                    {toInitCap("Quantity")} :
                    <span className="ml-1 font-semibold text-stone-900">
                      {reportData?.summary?.total_quantity ?? totalQuantity}
                    </span>
                  </span>

                  <span>
                    {toInitCap("Total Amount")} :
                    <span className="ml-1 font-semibold text-stone-900">₹{formatMoney(resolvedAmount)}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

