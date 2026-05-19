import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Pubmenubuy from "../../buy/pages/Pubmenubuy";
import { cartAPI } from "../../../services/api";

export default function CartBuy() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const basePath = location.pathname.startsWith("/attendant") ? "/attendant" : "/user";
  const existingOrderNumber = searchParams.get("orderNumber") || location.state?.orderNumber || "";
  const [error, setError] = useState("");
  const [resolvedOrderNumber, setResolvedOrderNumber] = useState(existingOrderNumber);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      try {
        setError("");

        // If an order number was already provided, render the review UI.
        if (existingOrderNumber) {
          if (!ignore) setResolvedOrderNumber(existingOrderNumber);
          return;
        }

        // Legacy URL `/cart/buy` without orderNumber: create the order from cart now.
        const response = await cartAPI.confirmOrder({});
        const orderNumber = response?.data?.data?.orderNumber;
        if (!orderNumber) throw new Error("Order number not returned");

        if (!ignore) {
          setResolvedOrderNumber(orderNumber);
          navigate(`${basePath}/cart/buy?orderNumber=${encodeURIComponent(orderNumber)}`, {
            replace: true,
            state: { orderNumber },
          });
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.response?.data?.message || err?.message || "Unable to proceed to checkout.");
        }
      }
    };

    run();
    return () => {
      ignore = true;
    };
  }, [basePath, existingOrderNumber, navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Checkout</h1>
          <p className="mt-3 text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => navigate(`${basePath}/cart`)}
            className="mt-6 rounded-full border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Back to Cart
          </button>
        </div>
      </div>
    );
  }

  if (!resolvedOrderNumber) return null;

  return (
    <Pubmenubuy
      backTo={`${basePath}/cart`}
      afterConfirmTo={`${basePath}/confirm-order-page`}
    />
  );
}
