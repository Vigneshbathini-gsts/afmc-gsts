import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cartAPI } from "../../services/api";

export default function CartPage({ isAttendant = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const userId = user?.userId;

  const fetchCartItems = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      const response = await cartAPI.getByUserId(userId);
      setCartItems(response.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load cart items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartItems();
  }, [userId]);

  const handleQuantityUpdate = async (cartId, quantity) => {
    setLoading(true);
    try {
      await cartAPI.updateQuantity(cartId, quantity);
      await fetchCartItems();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to update quantity");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (cartId) => {
    if (!window.confirm("Remove this item from cart?")) {
      return;
    }

    setLoading(true);
    try {
      await cartAPI.deleteItem(cartId);
      await fetchCartItems();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to remove item");
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (itemId) => {
    navigate(`/user/item/${itemId}`);
  };

  const totalAmount = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [cartItems]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isAttendant ? "Attendant Cart" : "Your Cart"}</h1>
          <p className="text-sm text-gray-500">Review cart items before checkout.</p>
        </div>
        {loading && <span className="text-sm text-afmc-maroon">Loading...</span>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && cartItems.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600">
          No items in the cart.
        </div>
      )}

      <div className="space-y-4">
        {cartItems.map((item) => (
          <div
            key={item.cartId}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={item.image || "/images/default-item.png"}
                  alt={item.itemName}
                  className="h-20 w-20 rounded-2xl object-cover"
                />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{item.itemName}</h2>
                  <p className="text-sm text-gray-600">{item.description || "No description"}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    Price: <span className="font-medium">₹{item.price.toFixed(2)}</span>
                  </p>
                  <p className="text-sm text-gray-500">UOM: {item.uom || "N/A"}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-right">
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
                  <button
                    onClick={() => handleQuantityUpdate(item.cartId, Math.max(1, item.quantity - 1))}
                    className="rounded-full bg-white px-2 py-1 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="min-w-[32px] text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    onClick={() => handleQuantityUpdate(item.cartId, item.quantity + 1)}
                    className="rounded-full bg-white px-2 py-1 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>

                <div className="text-sm text-gray-500">
                  Total: <span className="font-semibold text-gray-900">₹{item.total.toFixed(2)}</span>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {item.stockStatus === "Out Of Stock" ? (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                      Out Of Stock
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                      In Stock
                    </span>
                  )}

                  {item.subcategory && [14, 15].includes(Number(item.subcategory)) && !isAttendant && (
                    <button
                      type="button"
                      onClick={() => handleEditItem(item.itemId)}
                      className="inline-flex items-center gap-2 rounded-full border border-afmc-maroon/20 bg-white px-3 py-1 text-xs font-semibold text-afmc-maroon transition hover:bg-afmc-maroon/5"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.cartId)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {cartItems.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-gray-500">Grand total</p>
              <p className="text-3xl font-semibold text-gray-900">₹{totalAmount.toFixed(2)}</p>
            </div>

            <button
              type="button"
              className="rounded-2xl bg-afmc-maroon px-6 py-3 text-sm font-semibold text-white transition hover:bg-afmc-maroon/90"
              onClick={() => navigate(isAttendant ? "/attendant/confirm-order" : "/user/confirm-order")}
            >
              Proceed to checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
