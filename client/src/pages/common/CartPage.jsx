import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cartAPI } from "../../services/api";
import { Trash2, Minus, Plus, X, Pencil } from "lucide-react";

const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

// Toast component for notifications
const Toast = ({ message, type, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for fade animation
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div 
            className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg p-4 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'
                } text-white min-w-[200px] transition-all duration-300 ease-in-out pointer-events-auto ${
                    isVisible 
                        ? 'opacity-100 translate-y-0' 
                        : 'opacity-0 translate-y-3 pointer-events-none'
                }`}
        >
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{message}</span>
                <button onClick={() => {
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }} className="hover:opacity-80">
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

// Confirmation Modal component
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-600">{message}</p>
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function CartPage({ isAttendant = false }) {
    const { user, setCartCount } = useAuth();
    const navigate = useNavigate();
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [updatingItemId, setUpdatingItemId] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, cartId: null });
    const [proceedConfirmOpen, setProceedConfirmOpen] = useState(false);

    const userId = user?.userId;

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
    }, []);

    const fetchCartItems = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);

        try {
            const response = await cartAPI.getByUserId(userId);
            const items = response.data.data || [];
            // console.log(items);
            setCartItems(items);
            setCartCount(items.length);
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to load cart items");
            showToast("Failed to load cart items", 'error');
        } finally {
            setLoading(false);
        }
    }, [userId, setCartCount]);

    useEffect(() => {
        fetchCartItems();
    }, [fetchCartItems]);

    const handleQuantityUpdate = useCallback(async (cartId, newQuantity) => {
        if (!cartId || Number.isNaN(Number(cartId))) {
            showToast("Invalid cart item selected", 'error');
            return;
        }
        if (newQuantity < 1) return;

        setUpdatingItemId(cartId);

        try {
            const response = await cartAPI.updateQuantity(cartId, newQuantity);
            const items = response.data.data || [];
            setCartItems(items);
            setCartCount(items.length);
            showToast("Quantity updated successfully");
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to update quantity");
            showToast(err?.response?.data?.message || "Failed to update quantity", 'error');
        } finally {
            setUpdatingItemId(null);
        }
    }, [setCartCount]);

    const handleRemoveItem = useCallback(async () => {
        const { cartId } = confirmModal;
        if (!cartId || Number.isNaN(Number(cartId))) {
            showToast("Invalid cart item selected", 'error');
            return;
        }

        setConfirmModal({ isOpen: false, cartId: null });

        try {
            const response = await cartAPI.deleteItem(cartId);
            const items = response.data.data || [];
            setCartItems(items);
            setCartCount(items.length);
            showToast("Item removed from cart");
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to remove item");
            showToast(err?.response?.data?.message || "Failed to remove item", 'error');
        }
    }, [confirmModal, setCartCount]);

    const handleEditItem = useCallback((itemId, cartId) => {
        const basePath = isAttendant ? "/attendant" : "/user";
        navigate(`${basePath}/item/${itemId}?cartId=${encodeURIComponent(cartId)}`, { state: { cartId } });
    }, [navigate, isAttendant]);

    const handleProceedToBuy = useCallback(() => {
        if (cartItems.length === 0) return;
        setProceedConfirmOpen(true);
    }, [cartItems.length]);

    const handleProceedConfirm = useCallback(() => {
        const proceed = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await cartAPI.proceedToBuy();
                const orderNumber = response?.data?.data?.orderNumber;
                if (!orderNumber) {
                    throw new Error("Order number not returned");
                }

                setProceedConfirmOpen(false);
                const basePath = isAttendant ? "/attendant" : "/user";
                navigate(`${basePath}/confirm-order?orderNumber=${encodeURIComponent(orderNumber)}`);
            } catch (err) {
                setProceedConfirmOpen(false);
                const msg = err?.response?.data?.message || err?.message || "Unable to create order.";
                setError(msg);
                showToast(msg, "error");
            } finally {
                setLoading(false);
            }
        };

        proceed();
    }, [navigate, isAttendant, showToast]);

    const handleGoToMenu = useCallback(() => {
        const basePath = isAttendant ? "/attendant" : "/user";
        navigate(`${basePath}/menudash`);
    }, [navigate, isAttendant]);

    // Show remove confirmation
    const confirmRemove = useCallback((cartId) => {
        setConfirmModal({ isOpen: true, cartId });
    }, []);

    return (
        <div className="space-y-4 pb-20 md:pb-4">
            {/* Toast Notifications - Always rendered, visibility controlled via CSS */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, cartId: null })}
                onConfirm={handleRemoveItem}
                title="Remove Item"
                message="Are you sure you want to remove this item from your cart?"
                confirmLabel="Remove"
            />

            <ConfirmModal
                isOpen={proceedConfirmOpen}
                onClose={() => setProceedConfirmOpen(false)}
                onConfirm={handleProceedConfirm}
                title="Confirm Purchase"
                message="Are you sure you want to proceed to buy?"
                confirmLabel="Yes, proceed"
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{isAttendant ? "Attendant Cart" : "Your Cart"}</h1>
                    <p className="text-sm text-gray-500">Review cart items before checkout.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleGoToMenu}
                        className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        Go to Menu
                    </button>
                    <button
                        onClick={handleProceedToBuy}
                        disabled={cartItems.length === 0}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition ${cartItems.length === 0
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-red-700 hover:bg-red-800"
                            }`}
                    >
                        Proceed to Buy
                    </button>
                </div>
            </div>

            {loading && cartItems.length === 0 && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700"></div>
                </div>
            )}

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

            {/* Cart Items Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cartItems.map((item) => (
                    <div
                        key={item.cartId}
                        className={`flex flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md ${updatingItemId === item.cartId ? 'opacity-70' : ''
                            }`}
                    >
                        {/* Image and Action Buttons Row */}
                        <div className="relative mb-2 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                            <div className="relative w-full h-32 flex items-center justify-center">
                                <img
                                    src={`${BASEAPI}${item.image || "default.jpg"}`}
                                    alt={item.itemName || "Item"}
                                    className="w-full h-full object-contain rounded-lg"
                                    onError={(e) => {
                                        e.target.src = "https://via.placeholder.com/200x150?text=No+Image";
                                    }}
                                />
                                {/* Action Buttons Overlay - Top Right */}
                                <div className="absolute right-1 top-1 flex gap-1 z-10">
                                    {/* Edit Button - Only show for items with subcategory 14 or 15 (cocktail/mocktail) */}
                                    {item.subcategory && [14, 15].includes(Number(item.subcategory)) && !item.isFreeItem && (
                                        <button
                                            type="button"
                                            onClick={() => handleEditItem(item.itemId, item.cartId)}
                                            className="rounded-full bg-white/90 p-1.5 text-blue-600 shadow-md transition hover:bg-blue-50"
                                            title="Edit item"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                    {/* Remove Button - Only for non-free items */}
                                    {!item.isFreeItem && (
                                        <button
                                            type="button"
                                            onClick={() => confirmRemove(item.cartId)}
                                            className="rounded-full bg-white/90 p-1.5 text-red-600 shadow-md transition hover:bg-red-50"
                                            title="Remove item"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1">
                            <h2 className="text-sm font-semibold text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap">
                                {item.itemName || "Unnamed Item"}
                            </h2>

                            {/* <p className={`text-xs mt-1 ${item.stockStatus === "Out Of Stock" ? "text-red-600" : "text-green-600"
                                }`}>
                                {item.stockStatus || "Checking Stock"}
                            </p> */}
                        </div>

                        {/* Quantity Controls */}
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                            {!item.isFreeItem ? (
                                <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
                                    <button
                                        onClick={() => handleQuantityUpdate(item.cartId, Math.max(1, (item.quantity || 1) - 1))}
                                        className="rounded-full bg-white px-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50"
                                        disabled={updatingItemId === item.cartId || item.quantity <= 1}
                                    >
                                        <Minus size={12} />
                                    </button>
                                    <span className="min-w-[28px] text-center text-xs font-semibold">
                                        {item.quantity || 1}
                                    </span>
                                    <button
                                        onClick={() => handleQuantityUpdate(item.cartId, (item.quantity || 1) + 1)}
                                        className="rounded-full bg-white px-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50"
                                        disabled={updatingItemId === item.cartId}
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-gray-600">
                                    Qty: {item.quantity || 1} (Free)
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add custom CSS for animations */}
            <style jsx>{`
                @keyframes scale-in {
                    from {
                        transform: scale(0.95);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                
                .animate-scale-in {
                    animation: scale-in 0.2s ease-out;
                }
            `}</style>
        </div>
    );
}
