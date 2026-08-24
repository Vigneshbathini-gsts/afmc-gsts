import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { cartAPI } from "../../../services/api";
import { Trash2, Minus, Plus, Pencil } from "lucide-react";
import { toast } from "react-toastify";
import { getMaxAllowedQuantity, getItemPegMultiplier, getPegTypeOrderLimitMessage, isOutOfStock, isCocktailOrMocktail } from "../../../utils/stockValidation";

// Cache cocktail details per cart item
// so we can validate ingredient-level stock before quantity changes.
import { toInitCap } from "../../../utils/textFormat";
import { getCartCount } from "../../../utils/cartCount";
import {
    clearSelectedAttendantCustomer,
    getSelectedAttendantCustomerPayload,
} from "../../../utils/attendantCustomer";

const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

// Confirmation Modal component
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="mt-6 flex flex-row gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 sm:flex-none inline-flex justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 sm:flex-none inline-flex justify-center rounded-full bg-afmc-maroon px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-afmc-maroon2"
                    >
                        {confirmLabel}
                    </button>
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
    const [cocktailDetailsByCartId, setCocktailDetailsByCartId] = useState({});
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, cartId: null });
    const [proceedConfirmOpen, setProceedConfirmOpen] = useState(false);
    const [stockLimitImageMessages, setStockLimitImageMessages] = useState({});
    const [failedImageKeys, setFailedImageKeys] = useState({});
    const quantityDebounceRef = useRef({});
    const pendingQuantityRef = useRef({});
    const confirmedQuantityRef = useRef({});

    const activeStockToast = useRef(null);


    const stockToastId = "stock-alert";

    const showStockAlert = useCallback((message) => {
        if (toast.isActive(stockToastId)) {
            return;
        }

        toast.error(message, {
            toastId: stockToastId,
            autoClose: 3000,
        });
    }, []);




    const userId = user?.userId;

    const SUCCESS_TOAST_ID = "cart-success";
    const ERROR_TOAST_ID = "cart-error";

    const showToast = useCallback((message, type = "success") => {
        const toastId =
            type === "success"
                ? SUCCESS_TOAST_ID
                : ERROR_TOAST_ID;

        if (toast.isActive(toastId)) return;

        if (type === "success") {
            toast.success(message, {
                toastId,
                autoClose: 2000,
            });
        } else {
            toast.error(message, {
                toastId,
                autoClose: 3000,
            });
        }
    }, []);




    const getStockLimitImageKey = useCallback((item) => String(Number(item?.cartId ?? item?.id) || item?.cartId || item?.id || item?.itemId || ""), []);

    const showStockLimitOnImage = useCallback((item, message = "Out of Stock") => {
        const key = getStockLimitImageKey(item);
        if (!key) return;
        setStockLimitImageMessages((current) => ({
            ...current,
            [key]: message,
        }));
        window.setTimeout(() => {
            setStockLimitImageMessages((current) => {
                if (current[key] !== message) return current;
                const next = { ...current };
                delete next[key];
                return next;
            });
        }, 3000);
    }, [getStockLimitImageKey]);

    const clearStockLimitOnImage = useCallback((item) => {
        const key = getStockLimitImageKey(item);
        if (!key) return;
        setStockLimitImageMessages((current) => {
            if (!current[key]) return current;
            const next = { ...current };
            delete next[key];
            return next;
        });
    }, [getStockLimitImageKey]);

    useEffect(() => {
        cartItems.forEach((it) => {
            confirmedQuantityRef.current[it.cartId] = it.quantity;
        });
    }, [cartItems]);



    const fetchCartItems = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);

        try {
            const response = await cartAPI.getByUserId(userId);
            const items = response.data.data || [];
            // console.log("Fetched cart items:", items);
            setCartItems(items);
            setCartCount(getCartCount(items));
            // Pre-fetch cocktail details for cocktail/mocktail items
            try {
                const cocktailMap = {};
                await Promise.all(
                    (items || [])
                        .filter((it) => isCocktailOrMocktail(it))
                        .map(async (it) => {
                            try {
                                const res = await cartAPI.getCocktailDetails(it.cartId);
                                cocktailMap[String(it.cartId)] = res?.data?.data?.ingredients || [];
                            } catch (_) {
                                cocktailMap[String(it.cartId)] = [];
                            }
                        })
                );
                setCocktailDetailsByCartId(cocktailMap);
            } catch (_) {
                // ignore
            }
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to load cart items");
            showToast("Failed to load cart items", 'error');
        } finally {
            setLoading(false);
        }
    }, [userId, setCartCount]);

    useEffect(() => {
        fetchCartItems();
    }, [fetchCartItems, userId]);

    const handleQuantityUpdate = useCallback(async (cartId, newQuantity) => {
        if (!cartId || Number.isNaN(Number(cartId))) {
            showToast("Invalid cart item selected", 'error');
            return false;
        }
        if (newQuantity < 1) return false;

        setUpdatingItemId(cartId);
        setError(null);

        try {
            const currentItem = cartItems.find((c) => Number(c.cartId) === Number(cartId));
            if (currentItem && isCocktailOrMocktail(currentItem)) {
                let details = cocktailDetailsByCartId[String(cartId)];
                if (!Array.isArray(details)) {
                    try {
                        const res = await cartAPI.getCocktailDetails(cartId);
                        details = res?.data?.data?.ingredients || [];
                        setCocktailDetailsByCartId((m) => ({ ...m, [String(cartId)]: details }));
                    } catch (e) {
                        details = [];
                    }
                }

                const ingredients = (details || [])
                    .map((d) => ({
                        itemCode: Number(d?.ITEM_CODE ?? d?.itemCode),
                        pegs: Number(d?.PEGS ?? d?.pegs ?? d?.QUANTITY ?? d?.quantity ?? 0) || 0,
                        itemName: String(d?.ITEM_NAME ?? d?.itemName ?? "").trim(),
                    }))
                    .filter((x) => Number.isFinite(x.itemCode) && x.itemCode > 0 && x.pegs > 0);

                if (ingredients.length > 0) {
                    try {
                        const codes = [...new Set(ingredients.map((ing) => ing.itemCode))];
                        const stockRes = await cartAPI.getIngredientStocks(codes, undefined, undefined, cartId);
                        const stockMap = stockRes?.data?.data || {};
                        const multiplier = getItemPegMultiplier(currentItem);
                        console.log("Current Item:", currentItem);
console.log("Type:", currentItem.type);
console.log("Multiplier:", getItemPegMultiplier(currentItem));
                        for (const ing of ingredients) {
                            const rawAvailable = stockMap?.[String(ing.itemCode)];
                            if (rawAvailable === undefined || rawAvailable === null || rawAvailable === "") continue;

                            const available = Number(rawAvailable);
                            if (!Number.isFinite(available) || available < 0) continue;

                            const required =
                                ing.pegs * Number(newQuantity || 1) * multiplier;

                            if (required > available) {
                                const msg = `Out of stock for ingredient ${ing.itemName || ing.itemCode}. Available quantity: ${available}`;
                                showStockAlert(msg);
                                showStockLimitOnImage(currentItem, "Out of Stock");
                                setUpdatingItemId(null);
                                return false;
                            }
                        }
                    } catch (err) {
                        // ignore stock check failure — do not hard block
                    }
                }
            }

            const currentItemForMax = cartItems.find((c) => Number(c.cartId) === Number(cartId));
            if (currentItemForMax && !isCocktailOrMocktail(currentItemForMax)) {
                const maxAllowed = getMaxAllowedQuantity(currentItemForMax);
                const hasKnownAvailableStock = Number.isFinite(Number(maxAllowed)) && Number(maxAllowed) > 0;
                if (!hasKnownAvailableStock && isOutOfStock(currentItemForMax)) {
                    const msg = Number(maxAllowed) === 0
                        ? "Out of stock. Available quantity: 0"
                        : "Out of stock.";

                    showStockAlert(msg);
                    showStockLimitOnImage(currentItemForMax, "Out of Stock");
                    setUpdatingItemId(null);
                    return false;
                }

                if (Number.isFinite(Number(maxAllowed)) && Number(maxAllowed) >= 0) {
                    const multiplier = getItemPegMultiplier(currentItemForMax);
                    const effectiveAllowed = multiplier > 1 ? Math.floor(Number(maxAllowed) / multiplier) : Number(maxAllowed);
                    if (effectiveAllowed <= 0) {
                        showStockAlert("Out of stock. Available quantity: 0");
                        setUpdatingItemId(null);
                        return false;
                    }
                    if (Number(newQuantity) > effectiveAllowed) {
                        const msg = getPegTypeOrderLimitMessage(currentItemForMax, Number(maxAllowed), `Out of stock. Available quantity: ${effectiveAllowed}`);
                        showStockAlert(msg);
                        setUpdatingItemId(null);
                        return false;
                    }
                }
                if (Number.isFinite(Number(maxAllowed)) && Number(maxAllowed) > 0) {
                    clearStockLimitOnImage(currentItemForMax);
                }
            }

            const response = await cartAPI.updateQuantity(cartId, newQuantity);
            const items = response.data.data || [];
            setCartItems(items);
            setCartCount(getCartCount(items));
            showToast("Quantity updated successfully");
            return true;
        } catch (err) {
            showToast(err?.response?.data?.message || "Failed to update quantity", 'error');
            return false;
        } finally {
            setUpdatingItemId(null);
        }
    }, [cartItems, cocktailDetailsByCartId, setCocktailDetailsByCartId, setCartItems, setCartCount, showToast, showStockLimitOnImage, clearStockLimitOnImage]);

    const commitQuantityUpdate = useCallback((cartId, quantity) => {
        // Optimistic local update so the UI feels instant
        setCartItems((prev) =>
            prev.map((it) => (Number(it.cartId) === Number(cartId) ? { ...it, quantity } : it))
        );

        pendingQuantityRef.current[cartId] = quantity;

        if (quantityDebounceRef.current[cartId]) {
            clearTimeout(quantityDebounceRef.current[cartId]);
        }

        quantityDebounceRef.current[cartId] = setTimeout(async () => {
            const finalQty = pendingQuantityRef.current[cartId];
            delete quantityDebounceRef.current[cartId];
            delete pendingQuantityRef.current[cartId];
            await handleQuantityUpdate(cartId, finalQty); // your existing validated update function
        }, 500); // wait 500ms after the last click before hitting the server
    }, [handleQuantityUpdate]);

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
            setCartCount(getCartCount(items));
            showToast("Item removed from cart");

            if (items.length === 0) {
                // If cart is empty after deletion, navigate back to menu/dashboard
                const basePath = isAttendant ? "/attendant" : "/user";
                navigate(`${basePath}/menudash`, { replace: true });
            }
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
        if (hasOutOfStockItem) {
            showToast("Some items in your cart are out of stock. Please remove or update them before proceeding.", 'error');
            return;
        }
        setProceedConfirmOpen(true);
    }, [cartItems.length]);


    const getItemStockInfo = useCallback((item) => {
        const isCocktailItem = isCocktailOrMocktail(item);
        console.log(`Getting stock info for item ${item.cartId} (cocktail: ${isCocktailItem})`);
        const cocktailDetails = isCocktailItem ? cocktailDetailsByCartId[String(item.cartId)] : null;

        const cocktailDetailsStockStatus = Array.isArray(cocktailDetails) && cocktailDetails.length > 0
            ? (
                cocktailDetails.every((detail) => {
                    const status = String(detail?.stockStatus ?? detail?.stock_status ?? "").trim().toLowerCase();
                    return status === "in stock";
                })
                    ? "In Stock"
                    : "Out Of Stock"
            )
            : null;
        const maxAllowed = isCocktailItem ? null : getMaxAllowedQuantity(item);
        const hasNoAvailableStock = Number.isFinite(Number(maxAllowed)) && Number(maxAllowed) === 0;
        const hasKnownAvailableStock = Number.isFinite(Number(maxAllowed)) && Number(maxAllowed) > 0;
        const effectiveOutOfStock = isCocktailItem
            ? cocktailDetailsStockStatus === "Out Of Stock"
            : hasNoAvailableStock || (!hasKnownAvailableStock && isOutOfStock(item));

        return {
            isCocktailItem,
            cocktailDetails,
            cocktailDetailsStockStatus,
            maxAllowed,
            hasNoAvailableStock,
            hasKnownAvailableStock,
            effectiveOutOfStock,
        };
    }, [cocktailDetailsByCartId]);

    const hasOutOfStockItem = useMemo(
        () => cartItems.some((item) => !item.isFreeItem && getItemStockInfo(item).effectiveOutOfStock),
        [cartItems, getItemStockInfo]
    );


    const handleProceedConfirm = useCallback(() => {

        const proceed = async () => {
            try {
                setLoading(true);
                setError(null);

                // Build combined consumption map (normal items + cocktail ingredients)
                const stockConsumption = new Map();

                // Add normal items consumption
                for (const item of cartItems) {
                    if (!isCocktailOrMocktail(item)) {
                        const code = Number(item.itemId || item.item_code || item.ITEM_CODE);
                        if (!Number.isFinite(code) || code <= 0) continue;
                        const multiplier = getItemPegMultiplier(item);
                        const effectiveQty = Number(item.quantity || 0) * multiplier;
                        stockConsumption.set(code, (stockConsumption.get(code) || 0) + effectiveQty);
                    }
                }

                // Add cocktail/mocktail ingredient consumption (ensure details are loaded)
                for (const item of cartItems) {
                    if (!isCocktailOrMocktail(item)) continue;
                    let details = cocktailDetailsByCartId[String(item.cartId)];
                    if (!Array.isArray(details)) {
                        try {
                            const res = await cartAPI.getCocktailDetails(item.cartId);
                            details = res?.data?.data?.ingredients || [];
                            setCocktailDetailsByCartId((m) => ({ ...m, [String(item.cartId)]: details }));
                        } catch (e) {
                            details = [];
                        }
                    }

                    for (const d of (details || [])) {
                        const code = Number(d?.ITEM_CODE ?? d?.itemCode ?? d?.item_id ?? d?.item_id);
                        const pegs = Number(d?.PEGS ?? d?.pegs ?? d?.QUANTITY ?? d?.quantity ?? 0) || 0;
                        if (!Number.isFinite(code) || code <= 0 || pegs <= 0) continue;
                        const required = pegs * Number(item.quantity || 0) * getItemPegMultiplier(item);
                        stockConsumption.set(code, (stockConsumption.get(code) || 0) + required);
                    }
                }

                const codes = [...new Set([...stockConsumption.keys()])].filter((c) => Number.isFinite(Number(c)) && Number(c) > 0);

                if (codes.length === 0) {
                    showToast("No valid items or ingredient codes found to validate.", 'error');
                    setLoading(false);
                    setProceedConfirmOpen(false);
                    return;
                }

                // Fetch ingredient stocks (API may return available after subtracting carts)
                const stocksRes = await cartAPI.getIngredientStocks(codes);
                const stocksMap = stocksRes?.data?.data || {};

                // Validate required against returned availability. The API may return availability
                // that already subtracts current cart consumption; to avoid false negatives we add
                // back the current cart consumption for each code when comparing.
                for (const code of codes) {
                    const required = Number(stockConsumption.get(code) || 0);
                    const availableApi = Number(stocksMap[String(code)] ?? 0);
                    const availableForOrder = availableApi + required; // add back current cart consumption

                    if (required > availableForOrder) {
                        showToast(`Insufficient stock for item ${code}. Required: ${required}, Available: ${availableApi}`, 'error');
                        // find an item using this code to show image overlay
                        const offendingItem = cartItems.find((it) => Number(it.itemId) === Number(code) || String(it.cartId) in cocktailDetailsByCartId && (cocktailDetailsByCartId[String(it.cartId)] || []).some(d => Number(d?.ITEM_CODE ?? d?.itemCode) === Number(code)));
                        if (offendingItem) showStockLimitOnImage(offendingItem, 'Out of Stock');
                        setProceedConfirmOpen(false);
                        setLoading(false);
                        return;
                    }
                }

                // All good — create the order
                const selectedPubmed = sessionStorage.getItem("afmc:selectedPubmed") || "";
                const response = await cartAPI.confirmOrder({
                    ...(selectedPubmed ? { pubmed: selectedPubmed } : {}),
                    ...(isAttendant ? getSelectedAttendantCustomerPayload() : {}),
                });
                const orderNumber = response?.data?.data?.orderNumber;
                if (!orderNumber) {
                    throw new Error("Order number not returned");
                }

                if (isAttendant) {
                    clearSelectedAttendantCustomer();
                }

                setProceedConfirmOpen(false);
                const basePath = isAttendant ? "/attendant" : "/user";
                navigate(`${basePath}/cart/buy?orderNumber=${encodeURIComponent(orderNumber)}`, {
                    state: { orderNumber },
                });
            } catch (err) {
                setProceedConfirmOpen(false);
                const msg = err?.response?.data?.message || err?.message || "Unable to create order.";
                setError(msg);
                showStockAlert(msg);
            } finally {
                setLoading(false);
            }
        };

        proceed();
    }, [navigate, isAttendant, showToast, cartItems, cocktailDetailsByCartId, setCocktailDetailsByCartId, showStockLimitOnImage]);

    const handleGoToMenu = useCallback(() => {
        const basePath = isAttendant ? "/attendant" : "/user";
        // Use replace to avoid leaving the cart page in history
        // so browser Back goes to the previous dashboard instead of back to cart
        navigate(`${basePath}/menudash`, { replace: true });
    }, [navigate, isAttendant]);

    // Show remove confirmation
    const confirmRemove = useCallback((cartId) => {
        setConfirmModal({ isOpen: true, cartId });
    }, []);

    return (
        <div className="space-y-4 pb-20 md:pb-4">
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, cartId: null })}
                onConfirm={handleRemoveItem}
                title={toInitCap("Remove Item")}
                message={toInitCap("Are you sure you want to remove this item from your cart?")}
                confirmLabel={toInitCap("Remove")}
            />

            <ConfirmModal
                isOpen={proceedConfirmOpen}
                onClose={() => setProceedConfirmOpen(false)}
                onConfirm={handleProceedConfirm}
                title={toInitCap("Confirm Purchase")}
                message={toInitCap("Are you sure you want to proceed to buy?")}
                confirmLabel={toInitCap("Yes, proceed")}
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold">
                        {toInitCap(isAttendant ? "Attendant Cart" : "Your Cart")}
                    </h1>
                    <p className="text-sm text-gray-500">{toInitCap("Review cart items before checkout.")}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleGoToMenu}
                        className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        {toInitCap("Go to menu")}
                    </button>
                    <button
                        onClick={handleProceedToBuy}
                        disabled={cartItems.length === 0 || hasOutOfStockItem}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition ${cartItems.length === 0 || hasOutOfStockItem
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-red-700 hover:bg-red-800"
                            }`}
                    >
                        {toInitCap("Proceed to buy")}
                    </button>
                </div>
            </div>

            {loading && cartItems.length === 0 && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700"></div>
                </div>
            )}

            {/* {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )} */}

            {!loading && cartItems.length === 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600">
                    {toInitCap("No items in the cart.")}
                </div>
            )}

            {/* Cart Items Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cartItems.map((item) => {
                    const imageKey = String(item.cartId);
                    const imageUrl = item.image ? `${BASEAPI}${item.image}` : "";
                    const showImagePlaceholder = !imageUrl || failedImageKeys[imageKey];
                    const isCocktailItem = isCocktailOrMocktail(item);
                    const cocktailDetails = isCocktailItem ? cocktailDetailsByCartId[String(item.cartId)] : null;
                    const cocktailDetailsStockStatus = Array.isArray(cocktailDetails) && cocktailDetails.length > 0
                        ? (
                            cocktailDetails.every((detail) => {
                                const status = String(detail?.stockStatus ?? detail?.stock_status ?? "").trim().toLowerCase();
                                return status === "in stock";
                            })
                                ? "In Stock"
                                : "Out Of Stock"
                        )
                        : null;
                    const maxAllowed = isCocktailItem ? null : getMaxAllowedQuantity(item);
                    const hasNoAvailableStock =
                        Number.isFinite(Number(maxAllowed)) &&
                        Number(maxAllowed) === 0;
                    const hasKnownAvailableStock =
                        Number.isFinite(Number(maxAllowed)) &&
                        Number(maxAllowed) > 0;
                    const effectiveOutOfStock =
                        isCocktailItem
                            ? cocktailDetailsStockStatus === "Out Of Stock"
                            : hasNoAvailableStock || (!hasKnownAvailableStock && isOutOfStock(item));
                    const imageStockMessage =
                        isCocktailItem
                            ? ""
                            : hasNoAvailableStock
                                ? "Out of Stock"
                                : stockLimitImageMessages[getStockLimitImageKey(item)] || "";
                    const stockStatusText = effectiveOutOfStock
                        ? "Out Of Stock"
                        : cocktailDetailsStockStatus || (hasKnownAvailableStock
                            ? "In Stock"
                            : item.stockStatus);

                    return (
                        <div
                            key={item.cartId}
                            className={`flex flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md ${updatingItemId === item.cartId ? 'opacity-70' : ''
                                }`}
                        >
                            {/* Image and Action Buttons Row */}
                            <div className="relative mb-2 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                                <div className="relative w-full h-32 flex items-center justify-center">
                                    {showImagePlaceholder ? (
                                        <div className="flex h-full w-full items-center justify-center bg-gray-100 px-4 text-center text-sm font-semibold text-gray-500">
                                            {toInitCap(item.itemName) || toInitCap("No Image")}
                                        </div>
                                    ) : (
                                        <img
                                            src={imageUrl}
                                            alt={item.itemName || "Item"}
                                            className={`w-full h-full object-contain rounded-lg ${imageStockMessage ? "opacity-45" : ""}`}
                                            onError={() => {
                                                setFailedImageKeys((current) => ({ ...current, [imageKey]: true }));
                                            }}
                                        />
                                    )}
                                    {imageStockMessage ? (
                                        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/35 px-3 text-center">
                                            <span className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm">
                                                {imageStockMessage}
                                            </span>
                                        </div>
                                    ) : null}
                                    {/* Action Buttons Overlay - Top Right */}
                                    <div className="absolute right-1 top-1 flex gap-1 z-10">
                                        {/* Edit Button - Only show for customizable cocktail/mocktail recipe items */}
                                        {isCocktailItem && !item.isFreeItem && (
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
                                                title={toInitCap("Remove item")}
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
                                    {toInitCap(item.itemName) || toInitCap("Unnamed Item")}
                                </h2>
                                <h2 className="text-sm text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap">Type: {toInitCap(item.description || item.DESCRIPTION || item.type || 'NA')}</h2>


                                <p
                                    className={`text-xs mt-1 ${String(stockStatusText || "").toLowerCase() === "out of stock"
                                        ? "text-red-600"
                                        : "text-green-600"
                                        }`}
                                >
                                    {toInitCap(stockStatusText) || toInitCap("Checking Stock")}
                                </p>
                            </div>

                            {/* Quantity Controls */}
                            <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                                {!item.isFreeItem ? (
                                    <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
                                        <button
                                            onClick={async () => {
                                                const newQty = Math.max(1, (item.quantity || 1) - 1);
                                                const ok = await handleQuantityUpdate(item.cartId, newQty);
                                                if (!ok) {
                                                    const lastGood = confirmedQuantityRef.current[item.cartId];
                                                    if (lastGood !== undefined) {
                                                        setCartItems((prev) =>
                                                            prev.map((it) => (Number(it.cartId) === Number(item.cartId) ? { ...it, quantity: lastGood } : it))
                                                        );
                                                    }
                                                }
                                            }}
                                            className="rounded-full bg-white px-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50"
                                            disabled={updatingItemId === item.cartId || item.quantity <= 1}
                                        >
                                            <Minus size={12} />
                                        </button>
                                        <span className="min-w-[28px] text-center text-xs font-semibold">
                                            {item.quantity || 1}
                                        </span>
                                        <button
                                            onClick={async () => {
                                                const newQty = (item.quantity || 1) + 1;
                                                const ok = await handleQuantityUpdate(item.cartId, newQty);
                                                if (!ok) {
                                                    const lastGood = confirmedQuantityRef.current[item.cartId];
                                                    if (lastGood !== undefined) {
                                                        setCartItems((prev) =>
                                                            prev.map((it) => (Number(it.cartId) === Number(item.cartId) ? { ...it, quantity: lastGood } : it))
                                                        );
                                                    }
                                                }
                                            }}
                                            className="rounded-full bg-white px-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50"
                                            disabled={updatingItemId === item.cartId}
                                        >
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-600">
                                        {toInitCap("Qty")}: {item.quantity || 1} ({toInitCap("Free")})
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
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
