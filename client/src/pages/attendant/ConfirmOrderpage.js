import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronsLeft } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ConfirmOrderservice from "../../services/ConfirmOrderservice";

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-IN");
  }
  return date.toLocaleDateString("en-IN");
}

export default function ConfirmOrderpage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [error, setError] = useState("");
  const [orderData, setOrderData] = useState(null);

  const currentBasePath = location.pathname.startsWith("/attendant")
    ? "/attendant"
    : "/user";

  useEffect(() => {
    let ignore = false;

    const fetchConfirmedOrder = async () => {
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
            fetchError.response?.data?.message || "Unable to load confirmed order details."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchConfirmedOrder();
    return () => {
      ignore = true;
    };
  }, [orderNumber]);

  const items = Array.isArray(orderData?.items) ? orderData.items : [];
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [items]
  );

  return (
    <div className="min-h-screen bg-[#f5f1ec] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1280px] space-y-5">
        <div className="relative overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(153,27,27,0.08),transparent_45%),linear-gradient(90deg,transparent,rgba(120,113,108,0.06),transparent)]" />

          <div className="relative flex justify-end px-4 pt-4 md:px-6">
            <button
              type="button"
              onClick={() => navigate(`${currentBasePath}/menudash`)}
              className="inline-flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
            >
              <ChevronsLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          <div className="relative px-6 pb-12 pt-10 text-center md:px-12 md:pb-16 md:pt-14">
            <h1 className="text-3xl font-semibold text-red-600 md:text-4xl">
              Thank you for the order.
            </h1>
            <p className="mt-8 text-2xl font-medium text-green-600 md:text-3xl">
              Received Your Order
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <div className="bg-teal-700 px-5 py-4 text-xl font-semibold text-white">
            Invoice Report
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-stone-500">Loading confirmed order...</div>
          ) : error ? (
            <div className="px-6 py-10">
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            </div>
          ) : (
            <div className="space-y-8 px-6 py-8 md:px-10">
              <div className="text-center">
                <div className="text-[28px] font-medium text-stone-700">
                  Order Number :{" "}
                  <span className="font-bold text-stone-900">
                    {orderData?.header?.order_num || orderNumber}
                  </span>
                </div>
                <div className="mt-3 text-sm text-stone-500">
                  Order Date: {formatDate(orderData?.header?.order_date)}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-stone-200">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-stone-700">
                        Item Name
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-stone-700">
                        Quantity
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-semibold text-stone-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {items.map((item, index) => (
                      <tr key={`${item.item_id}-${index}`}>
                        <td className="px-4 py-4 text-sm text-stone-900">{item.item_name}</td>
                        <td className="px-4 py-4 text-sm text-stone-900">{item.quantity}</td>
                        <td className="px-4 py-4 text-sm font-medium text-green-700">
                          {item.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 px-5 py-4 text-sm text-stone-700 md:flex-row md:items-center md:justify-between">
                <div>Total Items: {items.length}</div>
                <div>Total Quantity: {totalQuantity}</div>
                <div>Order Status: {orderData?.header?.status || "Received"}</div>
              </div>

              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Go Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
