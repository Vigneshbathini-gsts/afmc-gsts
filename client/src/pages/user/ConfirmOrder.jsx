import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cartAPI } from "../../services/api";

export default function ConfirmOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Confirming your order...");
  const orderNumber = searchParams.get("orderNumber") || `ORD-${Date.now()}`;

  useEffect(() => {
    const confirmOrder = async () => {
      try {
        await cartAPI.confirmOrder({ orderNumber });
        setStatus("success");
        setMessage(`Order ${orderNumber} has been confirmed successfully.`);
      } catch (error) {
        setStatus("error");
        setMessage(
          error?.response?.data?.message || error?.message || "Unable to confirm your order."
        );
      }
    };

    confirmOrder();
  }, [orderNumber]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Confirm Order</h1>
        <p className="mt-3 text-gray-600">
          Order number: <span className="font-medium">{orderNumber}</span>
        </p>

        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-6">
          <p className={`text-base ${status === "error" ? "text-red-700" : "text-gray-800"}`}>
            {message}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => navigate(`/user/payment?orderNumber=${encodeURIComponent(orderNumber)}`)}
            className="rounded-full bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800"
            disabled={status !== "success"}
          >
            Go to Payment
          </button>
          <button
            onClick={() => navigate("/user/cart")}
            className="rounded-full border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Back to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
