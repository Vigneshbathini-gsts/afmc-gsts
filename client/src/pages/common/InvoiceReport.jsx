import React, { useMemo } from "react";
import { ChevronsLeft, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

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
  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";

  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const amount = Number(searchParams.get("amount") || location.state?.amount || 0);
  const invoiceData = location.state?.invoiceData || null;
  const items = Array.isArray(invoiceData?.items) ? invoiceData.items : [];
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  return (
    <div className="min-h-screen bg-[#f5f1ec] px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1180px] space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="flex justify-end px-4 pt-4">
            <button
              type="button"
              onClick={() => navigate(`${currentBasePath}/menudash`)}
              className="inline-flex items-center gap-2 rounded-full bg-[#6b0f1a] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#58101a]"
            >
              <ChevronsLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          <div className="px-6 pb-10 pt-5 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#d4af37]/30 bg-[#fff8eb]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6b0f1a] text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#c51616]">
              Thank You for the order.
            </h1>

            <p className="mt-3 text-3xl font-semibold text-[#0a7b20]">
              Completed Your Order
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
          <div className="border-b border-stone-200 bg-[#4f7f7b] px-5 py-4">
            <h2 className="inline-block bg-white px-2 text-lg font-semibold text-[#143235]">
              Invoice Report
            </h2>
          </div>

          <div className="p-5">
            <div className="mx-auto max-w-md space-y-5 rounded-[26px] bg-[#fffaf4] px-6 py-8 text-center">
              <div className="flex justify-between text-sm text-stone-600">
                <span>Invoice ID :</span>
                <span className="font-semibold text-stone-900">
                  {invoiceData?.invoice?.invoice_id || "-"}
                </span>
              </div>

              <div className="flex justify-between text-sm text-stone-600">
                <span>Order Number :</span>
                <span className="font-semibold text-stone-900">{orderNumber}</span>
              </div>

              <div className="flex justify-between text-sm text-stone-600">
                <span>Invoice Date :</span>
                <span className="font-semibold text-stone-900">
                  {formatDate(invoiceData?.invoice?.invoice_date || invoiceData?.header?.order_date)}
                </span>
              </div>

              <div className="flex justify-between text-sm text-stone-600">
                <span>Amount :</span>
                <span className="font-semibold text-stone-900">
                  {formatMoney(amount)}
                </span>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-2xl border border-stone-200">
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
                      Unit Price
                    </th>
                    <th className="px-5 py-3 text-left text-sm font-semibold text-[#6b0f1a]">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-200 bg-white">
                  {items.map((item, index) => (
                    <tr key={`${item.item_id}-${index}`}>
                      <td className="px-5 py-4 text-sm text-stone-800">{item.item_name}</td>
                      <td className="px-5 py-4 text-sm text-stone-700">{item.quantity}</td>
                      <td className="px-5 py-4 text-sm text-stone-900">{formatMoney(item.price)}</td>
                      <td className="px-5 py-4 text-sm text-stone-900">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#fffdf9]">
                    <td className="px-5 py-4 text-sm text-stone-800" />
                    <td className="px-5 py-4 text-sm text-stone-700">{totalQuantity}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#d11616]">Total</td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#d11616]">{formatMoney(amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
