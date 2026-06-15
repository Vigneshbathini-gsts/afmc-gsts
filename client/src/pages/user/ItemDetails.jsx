import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { inventoryAPI, cartAPI } from "../../services/api";
import { FaArrowLeft, FaPlus, FaMinus, FaTrash, FaSearch, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { toInitCap } from '../../utils/textFormat';

const getDetailItemCode = (detail) => detail?.itemCode ?? detail?.ITEM_CODE;
const getDetailItemName = (detail) => detail?.itemName ?? detail?.ITEM_NAME;
const getDetailPegs = (detail) => detail?.pegs ?? detail?.PEGS;
const getDetailStockQuantity = (detail) => detail?.stockQuantity ?? detail?.STOCK_QUANTITY ?? detail?.stock_quantity ?? null;
const getDetailStockStatus = (detail) => detail?.stockStatus ?? detail?.STOCK_STATUS ?? detail?.stock_status;
const getDetailRequiredQuantity = (detail) => detail?.requiredQuantity ?? detail?.REQUIRED_QUANTITY;
const normalizeDetail = (detail) => detail && ({
    ...detail,
    stockQuantity: getDetailStockQuantity(detail),
    stockStatus: getDetailStockStatus(detail),
});

const initCap = (str) => {
  if (!str) return "";

  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
export default function ItemDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const cartId = location.state?.cartId || new URLSearchParams(location.search).get("cartId");
    const isEditingCartItem = Boolean(cartId);
    const prefillDetails = location.state?.prefillDetails;
    const fromBuyFlow = Boolean(location.state?.fromBuyFlow);
    const buyOrderNumber = location.state?.orderNumber;
    const [item, setItem] = useState(null);
    console.log("item", item);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [quantities, setQuantities] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [lovData, setLovData] = useState([]);
    const [lovLoading, setLovLoading] = useState(false);

    // Track per-item out-of-stock toast cooldowns (timestamps) without causing re-renders.
    // Structure: { [itemKey]: { [normalizedMessage]: timestampMillis } }
    const outOfStockCooldownRef = useRef({});

    const isOutOfStockMessage = (msg) => /out\s*of\s*stock|available\s+quantity/i.test(String(msg || ""));

    const showToastWithCooldown = (message, type = "success", itemIdentifier = null) => {
        if (type !== "error" || !isOutOfStockMessage(message)) {
            if (type === "error") toast.error(message);
            else if (type === "warning") toast.warning(message);
            else toast.success(message);
            return;
        }

        // Generate key from item identifier (string or index number or itemCode)
        let key = null;
        if (typeof itemIdentifier === "string") {
            key = String(itemIdentifier);
        } else if (typeof itemIdentifier === "number") {
            key = String(itemIdentifier);
        }

        // If we don't have a key, don't suppress (avoid global suppression).
        if (!key) {
            toast.error(message);
            return;
        }

        const now = Date.now();
        const normalized = String(message || "").trim().toLowerCase();
        const map = outOfStockCooldownRef.current || (outOfStockCooldownRef.current = {});
        if (!map[key]) map[key] = {};

        const lastTs = map[key][normalized] || 0;
        const COOLDOWN_MS = 5000;
        if (now - lastTs < COOLDOWN_MS) {
            // suppressed
            return;
        }

        map[key][normalized] = now;
        toast.error(message);
    };

    const draftScope = fromBuyFlow && buyOrderNumber ? `buy:${buyOrderNumber}` : "default";

    const draftKey = `afmc-custom-item-draft:${user?.userId || "anon"}:${draftScope}:${id}`;

    const buildCustomizationPayload = useCallback((details, quantitiesState) => {
        return (details || [])
            .filter((detail, idx) => quantitiesState[idx] !== undefined)
            .map((detail, idx) => {
                const quantity = Number(quantitiesState[idx]);
                const rawUnitPrice = detail.unitPrice ?? detail.UNIT_PRICE;
                const rawLinePrice = detail.memberPrice ?? detail.PRICE;
                const baseQuantity = Number(getDetailPegs(detail) || quantity || 1);
                const calculatedUnitPrice = rawUnitPrice != null
                    ? Number(rawUnitPrice)
                    : Number(rawLinePrice || 0) > 0 && baseQuantity > 0
                        ? Number(rawLinePrice) / baseQuantity
                        : undefined;

                return {
                    itemCode: Number(getDetailItemCode(detail)),
                    itemName: getDetailItemName(detail),
                    quantity,
                    unitPrice: calculatedUnitPrice,
                };
            })
            .filter((ingredient) => Number.isFinite(ingredient.itemCode) && ingredient.itemCode > 0 && ingredient.quantity >= 0);
    }, []);

    const persistCustomDetails = useCallback(async (details, quantitiesState) => {
        if (!details) return true;

        if (isEditingCartItem && cartId) {
            try {
                await cartAPI.customizeCocktail(cartId, {
                    ingredients: buildCustomizationPayload(details, quantitiesState),
                });
                return true;
            } catch (err) {
                console.error("Error saving cart customization:", err);
                toast.error(err.response?.data?.message || err.message || "Failed to save customization");
                return false;
            }
        }

        try {
            localStorage.setItem(draftKey, JSON.stringify({ details, quantities: quantitiesState }));
        } catch (err) {
            console.warn("Could not save customization draft:", err);
        }
        return true;
    }, [buildCustomizationPayload, cartId, draftKey, isEditingCartItem]);

    // Auto-clear validation errors after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    useEffect(() => {
        const fetchItemDetails = async () => {
            try {
                setLoading(true);
                const response = await inventoryAPI.getById(id);
                if (response.data.success) {
                    const fetchedItem = response.data.data;
                    let details = fetchedItem.details || [];
                    let initialQuantities = {};

                    if (!isEditingCartItem && Array.isArray(prefillDetails) && prefillDetails.length > 0) {
                        details = prefillDetails;
                    }

                    if (!isEditingCartItem && fromBuyFlow && buyOrderNumber) {
                        try {
                            const itemCodeKey = String(fetchedItem.ITEM_CODE ?? fetchedItem.ITEM_ID ?? id ?? "").trim();
                            const overrideRaw = localStorage.getItem(`afmc-buyflow-custom:${buyOrderNumber}:${itemCodeKey}`);
                            const overrideValue = overrideRaw ? JSON.parse(overrideRaw) : null;
                            if (Array.isArray(overrideValue?.details) && overrideValue.details.length > 0) {
                                details = overrideValue.details;
                            }
                        } catch (err) {
                            console.warn("Could not load buyflow customization override:", err);
                        }
                    }

                    details.forEach((detail, idx) => {
                        const pegs = getDetailPegs(detail);
                        const fallbackQty = detail?.quantity ?? detail?.QUANTITY;
                        if (pegs !== 0 && pegs !== null) {
                            initialQuantities[idx] = pegs || 1;
                        } else if (fallbackQty !== undefined && fallbackQty !== null && fallbackQty !== "") {
                            initialQuantities[idx] = Number(fallbackQty) || 0;
                        }
                    });

                    if (isEditingCartItem) {
                        try {
                            const savedResponse = await cartAPI.getCocktailDetails(cartId);
                            console.log("Fetched saved cocktail details for cart item:", savedResponse.data);
                            const savedCollection = savedResponse.data?.data || {};
                            const savedIngredients = savedCollection?.ingredients || [];
                            if (savedIngredients.length > 0) {
                                details = savedIngredients.map((ingredient) => normalizeDetail({
                                    itemName: ingredient.itemName,
                                    itemCode: ingredient.itemCode,
                                    pegs: ingredient.quantity,
                                    memberPrice: ingredient.lineTotal,
                                    unitPrice: ingredient.unitPrice,
                                    stockQuantity: ingredient.stockQuantity,
                                    stockStatus: ingredient.stockStatus,
                                    stock_status: ingredient.stock_status,
                                    STOCK_STATUS: ingredient.STOCK_STATUS,
                                    requiredQuantity: ingredient.requiredQuantity,
                                }));
                                initialQuantities = {};
                                details.forEach((detail, idx) => {
                                    initialQuantities[idx] = getDetailPegs(detail) || 1;
                                });
                                fetchedItem.cartItemQuantity = savedCollection?.cartItemQuantity;
                            }
                        } catch (err) {
                            console.warn("Could not load cart customization:", err);
                        }
                    } else if (!fromBuyFlow) {
                        try {
                            const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
                            if (draft?.details?.length) {
                                details = draft.details.map(normalizeDetail);
                                initialQuantities = draft.quantities || initialQuantities;
                            }
                        } catch (err) {
                            console.warn("Could not load customization draft:", err);
                        }
                    }

                    // Always refresh ingredient stock from the cart stock endpoint.
                    // That endpoint returns available stock after subtracting reserved stock.
                    if (Array.isArray(details) && details.length > 0) {
                        try {
                            const codes = [...new Set(details
                                .map((detail) => Number(getDetailItemCode(detail)))
                                .filter((code) => Number.isFinite(code) && code > 0))];
                            if (codes.length > 0) {
                                const stockRes = await cartAPI.getIngredientStocks(
                                    codes,
                                    fromBuyFlow ? buyOrderNumber : undefined
                                );
                                const stockMap = stockRes?.data?.data || {};
                                details = details.map((detail, idx) => {
                                    const itemCode = Number(getDetailItemCode(detail));
                                    const stockQuantity = stockMap?.[String(itemCode)];
                                    if (stockQuantity === undefined) return normalizeDetail(detail);

                                    const requiredQuantity = getDetailRequiredQuantity(detail);
                                    const displayRequired =
                                        requiredQuantity != null
                                            ? Number(requiredQuantity)
                                            : Number(initialQuantities?.[idx] ?? getDetailPegs(detail) ?? 1);
                                    const stockStatus =
                                        Number(stockQuantity) >= (Number.isFinite(displayRequired) ? displayRequired : 1)
                                            ? "In Stock"
                                            : "Out Of Stock";

                                    return normalizeDetail({
                                        ...detail,
                                        stockQuantity,
                                        stockStatus,
                                    });
                                });
                            }
                        } catch (err) {
                            console.warn("Could not enrich ingredient stocks:", err);
                        }
                    }

                    if (!isEditingCartItem && Array.isArray(prefillDetails) && prefillDetails.length > 0) {
                        try {
                            localStorage.setItem(draftKey, JSON.stringify({ details, quantities: initialQuantities }));
                        } catch (err) {
                            console.warn("Could not save customization draft:", err);
                        }
                    }

                    setItem({ ...fetchedItem, details, cartId: isEditingCartItem ? cartId : undefined });
                    setQuantities(initialQuantities);
                } else {
                    setError(response.data.message || "Failed to load item");
                }
            } catch (err) {
                console.error("Error fetching item:", err);
                setError("Failed to load item details");
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchItemDetails();
        }
    }, [buyOrderNumber, cartId, draftKey, fromBuyFlow, id, isEditingCartItem, prefillDetails]);

    const updateQuantity = async (index, delta) => {
        const oldQty = quantities[index] || 1;
        const newVal = oldQty + delta;
        if (newVal < 1) return;

        const currentDetail = item?.details?.[index];
        if (currentDetail) {
            const rawStockQuantity = getDetailStockQuantity(currentDetail);
            const stockQuantity =
                rawStockQuantity == null || rawStockQuantity === ""
                    ? null
                    : Number(rawStockQuantity);
            const cartItemQuantity = Number(item?.cartItemQuantity || 1);
            const effectiveCartQty = Number.isFinite(cartItemQuantity) && cartItemQuantity > 0 ? cartItemQuantity : 1;
            if (Number.isFinite(stockQuantity) && stockQuantity >= 0) {
                const requiredNext = Number(newVal) * effectiveCartQty;
                if (requiredNext > stockQuantity) {
                    const itemName = getDetailItemName(currentDetail);
                    showToastWithCooldown(`${itemName} available quantity: ${stockQuantity}`, "error", index);
                    return;
                }
            }
        }

        const newQuantities = { ...quantities, [index]: newVal };
        setQuantities(newQuantities);

        const saved = await persistCustomDetails(item?.details || [], newQuantities);
        if (!saved) {
            setQuantities((prev) => ({ ...prev, [index]: oldQty }));
        }
    };

    const deleteIngredient = async (index) => {
        const newDetails = (item?.details || []).filter((_, idx) => idx !== index);
        const newQuantities = {};
        Object.entries(quantities).forEach(([key, value]) => {
            const idx = Number(key);
            if (idx === index) return;
            const newIndex = idx > index ? idx - 1 : idx;
            newQuantities[newIndex] = value;
        });

        const saved = await persistCustomDetails(newDetails, newQuantities);
        if (saved) {
            setItem((prev) => ({
                ...prev,
                details: newDetails,
            }));
            setQuantities(newQuantities);
            toast.info("Ingredient removed from recipe");
        }
    };

    const fetchLovIngredients = async () => {
        if (!item?.SUB_CATEGORY) return;

        try {
            setLovLoading(true);
            const response = await cartAPI.getLovIngredients(item.SUB_CATEGORY);
            if (response.data.success) {
                setLovData(response.data.data);
                console.log("ingre",response.data.data)
                
            }
            
        } catch (err) {
            console.error("Error fetching LOV ingredients:", err);
            toast.error("Failed to load ingredients list");
        } finally {
            setLovLoading(false);
        }
    };

    const handleAddIngredientsClick = () => {
        const existingCount = item?.details?.length || 0;
        if (existingCount >= 5) {
            toast.warning("Maximum 5 ingredients already added. Remove some ingredients to add more.");
            return;
        }
        setShowModal(true);
        setSelectedIngredients([]);
        setSearchTerm("");
        fetchLovIngredients();
    };

    const handleIngredientSelect = (ingredient) => {
        // Calculate total ingredients (existing + selected)
        const existingCount = item?.details?.length || 0;
        const selectedCount = selectedIngredients.length;
        const totalCount = existingCount + selectedCount;
        
        if (totalCount >= 5) {
            toast.warning("Maximum 5 ingredients allowed per recipe");
            return;
        }

        const alreadySelected = selectedIngredients.some(item => item.d === ingredient.d);
        
        // Check if ingredient already exists in recipe
        const existingIngredientIndex = item?.details?.findIndex(
            (detail) => String(getDetailItemName(detail) || "").trim().toLowerCase() === String(ingredient.d || "").trim().toLowerCase()
                || String(getDetailItemCode(detail) || "").trim() === String(ingredient.r || "").trim()
        );

        if (alreadySelected) {
            toast.warning("Ingredient already selected");
            return;
        }

        if (existingIngredientIndex !== -1 && existingIngredientIndex >= 0) {
            // Ingredient exists, increase its quantity instead of adding new
            const currentQty = quantities[existingIngredientIndex] || 1;
            const newQty = currentQty + 1;
            
            // Check stock availability
            const existingDetail = item.details[existingIngredientIndex];
            const rawStockQuantity = getDetailStockQuantity(existingDetail);
            const stockQuantity = rawStockQuantity == null || rawStockQuantity === "" ? null : Number(rawStockQuantity);
            const cartItemQuantity = Number(item?.cartItemQuantity || 1);
            const effectiveCartQty = Number.isFinite(cartItemQuantity) && cartItemQuantity > 0 ? cartItemQuantity : 1;
            
            if (Number.isFinite(stockQuantity) && stockQuantity >= 0) {
                const requiredNext = newQty * effectiveCartQty;
                if (requiredNext > stockQuantity) {
                    const itemName = getDetailItemName(existingDetail);
                    showToastWithCooldown(`${itemName} available quantity: ${stockQuantity}`, "error", existingIngredientIndex);
                    return;
                }
            }
            
            // Update quantity
            const newQuantities = { ...quantities, [existingIngredientIndex]: newQty };
            setQuantities(newQuantities);
            persistCustomDetails(item?.details || [], newQuantities);
            
            toast.success(`${initCap(ingredient.d)} already exists increasing the  quantity ${newQty}`);
            return; // Don't add to selected ingredients list
        }

        setSelectedIngredients(prev => [...prev, ingredient]);
    };

    const handleRemoveSelectedIngredient = (index) => {
        setSelectedIngredients(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddIngredients = async () => {
        if (selectedIngredients.length === 0) {
            toast.warning("Please select at least one ingredient");
            return;
        }

        const existingCount = item?.details?.length || 0;
        const newTotal = existingCount + selectedIngredients.length;
        
        if (newTotal > 5) {
            toast.warning(`Cannot add ${selectedIngredients.length} ingredient(s). Maximum 5 ingredients allowed. You currently have ${existingCount} ingredient(s).`);
            return;
        }

        // Add selected ingredients to the item details with default quantity 1
        const newDetails = [...(item.details || [])];
        const newQuantities = { ...quantities };
        const startIndex = item.details?.length || 0;
        
        selectedIngredients.forEach((ingredient, idx) => {
            const rawStockQuantity = ingredient?.stockQuantity ?? ingredient?.STOCK_QUANTITY ?? ingredient?.stock_quantity ?? null;
            const stockQuantity =
                rawStockQuantity == null || rawStockQuantity === ""
                    ? null
                    : Number(rawStockQuantity);
            const stockStatusRaw = ingredient?.stockStatus ?? ingredient?.STOCK_STATUS ?? ingredient?.stock_status ?? null;
            
            newDetails.push({
                itemName: ingredient.d,
                itemCode: ingredient.r,
                pegs: 1,
                memberPrice: null,
                unitPrice: ingredient.unitPrice,
                stockQuantity,
                stockStatus:
                    stockStatusRaw ||
                    (Number.isFinite(stockQuantity) && stockQuantity >= 0
                        ? (stockQuantity > 0 ? "In Stock" : "Out Of Stock")
                        : "Unknown"),
            });
            
            newQuantities[startIndex + idx] = 1;
        });

        const saved = await persistCustomDetails(newDetails, newQuantities);
        if (!saved) {
            toast.error("Failed to add selected ingredients");
            return;
        }

        setItem(prev => ({
            ...prev,
            details: newDetails
        }));
        setQuantities(newQuantities);
        setShowModal(false);
        setSelectedIngredients([]);
        toast.success(`${selectedIngredients.length} ingredient(s) added successfully`);
    };

    const filteredLovData = lovData.filter(item =>
        item.d.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isDetailOutOfStock = (detail, index) => {
        const stockQuantity = Number(getDetailStockQuantity(detail));
        if (!Number.isFinite(stockQuantity) || stockQuantity < 0) return false;

        const requiredQuantity = Number(getDetailRequiredQuantity(detail) ?? quantities[index] ?? getDetailPegs(detail) ?? 1) || 1;
        return (
            String(getDetailStockStatus(detail)).trim().toLowerCase() === "out of stock" ||
            stockQuantity < requiredQuantity
        );
    };

    const hasOutOfStockIngredient = (item?.details || []).some((detail, index) => isDetailOutOfStock(detail, index));

    const handleAddToCart = async () => {
        if (!item) {
            toast.error("Unable to add item to cart");
            return;
        }

        const selectedIngredients = buildCustomizationPayload(item.details, quantities);

        const ingredientSummary = selectedIngredients
            .map((detail) => `${detail.itemName}:${detail.quantity}`)
            .join(", ");

        const basePath = location.pathname.includes("/attendant/")
            ? "/attendant"
            : "/user";

        const postSavePath =
            fromBuyFlow && buyOrderNumber
                ? `${basePath}/menudash/buy?orderNumber=${encodeURIComponent(buyOrderNumber)}`
                : `${basePath}/cart`;

        if (fromBuyFlow && !isEditingCartItem) {
            const ok = await persistCustomDetails(item?.details || [], quantities);
            if (ok) {
                try {
                    const itemCodeKey = String(item?.ITEM_CODE ?? item?.ITEM_ID ?? id ?? "").trim();
                    if (buyOrderNumber && itemCodeKey) {
                        const normalizedDetails = (item?.details || []).map((detail, idx) => {
                            const qty = Number(quantities?.[idx] ?? getDetailPegs(detail) ?? detail?.quantity ?? detail?.QUANTITY ?? 0) || 0;
                            const itemCode = getDetailItemCode(detail);
                            const itemName = getDetailItemName(detail);
                            const stockQuantity = getDetailStockQuantity(detail);
                            const requiredQuantity = getDetailRequiredQuantity(detail);

                            return {
                                ITEM_CODE: itemCode,
                                ITEM_NAME: itemName,
                                PEGS: qty,
                                QUANTITY: qty,
                                STOCK_QUANTITY: stockQuantity,
                                REQUIRED_QUANTITY: requiredQuantity,
                                STOCK_STATUS: getDetailStockStatus(detail),
                                UNIT_PRICE: detail?.unitPrice ?? detail?.UNIT_PRICE,
                                PRICE: detail?.memberPrice ?? detail?.PRICE,
                            };
                        }).filter((row) => Number(row.ITEM_CODE) > 0);
                        localStorage.setItem(
                            `afmc-buyflow-custom:${buyOrderNumber}:${itemCodeKey}`,
                            JSON.stringify({ details: normalizedDetails, savedAt: Date.now() })
                        );
                    }
                } catch (err) {
                    console.warn("Could not persist buyflow customization override:", err);
                }
                toast.success(`Saved ${item.ITEM_NAME} customization`);
                navigate(postSavePath);
            }
            return;
        }

        const payload = {
            item_id: item.ITEM_ID || item.ITEM_CODE,
            quantity: 1,
            unit_price: item.UNIT_PRICE || 0,
            remarks: ingredientSummary
                ? `Custom ingredients: ${ingredientSummary}`
                : "Din",
            cartId: isEditingCartItem ? Number(cartId) : undefined,
        };

        try {
            // Reservation/stock checks before adding/customizing
            try {
                const desiredQty = Number(payload.quantity || item?.cartItemQuantity || 1) || 1;

                // If customizing or selecting ingredients, validate ingredient stocks
                if (selectedIngredients && selectedIngredients.length > 0) {
                    const codes = [...new Set(selectedIngredients.map((d) => Number(d.itemCode)).filter((c) => Number.isFinite(c) && c > 0))];
                    if (codes.length > 0) {
                        try {
                            const stockRes = await cartAPI.getIngredientStocks(codes, buyOrderNumber);
                            const stockMap = stockRes?.data?.data || {};
                            for (const ing of selectedIngredients) {
                                const code = Number(ing.itemCode);
                                if (!Number.isFinite(code) || code <= 0) continue;
                                const rawAvailable = stockMap?.[String(code)];
                                if (rawAvailable === undefined || rawAvailable === null || rawAvailable === "") continue;
                                const available = Number(rawAvailable);
                                if (!Number.isFinite(available) || available < 0) continue;
                                const required = Number(ing.quantity || 0) * desiredQty;
                                if (required > available) {
                                    showToastWithCooldown(`${ing.itemName || code} available quantity: ${available}`, "error", code);
                                    return;
                                }
                            }
                        } catch (err) {
                            // ignore stock check failure
                        }
                    }
                }

                // Check parent item stock (non-cocktail)
                const parentCode = Number(item?.ITEM_CODE ?? item?.ITEM_ID ?? id) || null;
                if (!selectedIngredients || selectedIngredients.length === 0) {
                    if (Number.isFinite(parentCode) && parentCode > 0) {
                        try {
                            const stockRes = await cartAPI.getIngredientStocks([parentCode], buyOrderNumber);
                            const stockMap = stockRes?.data?.data || {};
                            const rawAvailable = stockMap?.[String(parentCode)];
                            if (rawAvailable !== undefined && rawAvailable !== null && rawAvailable !== "") {
                                const available = Number(rawAvailable);
                                if (Number.isFinite(available) && available >= 0 && desiredQty > available) {
                                    showToastWithCooldown(`Out of stock. Available quantity: ${available}`, "error", parentCode);
                                    return;
                                }
                            }
                        } catch (err) {
                            // ignore
                        }
                    }
                }
            } catch (err) {
                // ignore reservation check errors
            }

            const response = isEditingCartItem
                ? await cartAPI.customizeCocktail(cartId, { ingredients: selectedIngredients })
                : await cartAPI.addNewItem(payload);
            console.log('response', response.data);
            if (response?.data?.success) {
                const newCartId = response.data?.data?.cartId;
                if (!isEditingCartItem && newCartId) {
                    await cartAPI.customizeCocktail(newCartId, { ingredients: selectedIngredients });
                    localStorage.removeItem(draftKey);
                }

                toast.success(
                    isEditingCartItem
                        ? `Updated ${item.ITEM_NAME} customization`
                        : `Added ${item.ITEM_NAME} to cart with ${selectedIngredients.length} ingredients`
                );

                navigate(postSavePath);
            } else {
                toast.error(response?.data?.message || "Failed to add item to cart");
            }
        } catch (err) {
            console.error("Error adding item to cart:", err);
            if (err.response?.status === 401) {
                toast.error("Your session has expired. Please login again.");
            } else {
                toast.error(err.response?.data?.message || err.message || "Failed to add item to cart");
            }
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-stone-50">
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-afmc-gold/30 border-t-afmc-maroon"></div>
                    <p className="mt-4 text-sm font-medium text-stone-600">Loading item details...</p>
                </div>
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
                <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                    <h2 className="mb-4 text-2xl font-semibold text-stone-900">Item Not Found</h2>
                    <p className="mb-6 text-sm text-stone-600">{error || "The requested item could not be found."}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 rounded-full bg-afmc-maroon px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-afmc-maroon2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                        <FaArrowLeft className="text-xs" />
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 px-3 py-4 md:px-6">
            <div className="mx-auto max-w-[1180px] space-y-4">
                <div className="overflow-hidden rounded-2xl border border-afmc-gold/20 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                    <div className="bg-afmc-maroon px-5 py-5 text-white">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-white/80">
                                    Customize Ingredients
                                </p>
                                <h1 className="mt-1 text-2xl font-semibold leading-tight">{item.ITEM_NAME}</h1>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => navigate(-1)}
                                    className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-afmc-maroon"
                                >
                                    <FaArrowLeft className="text-xs" />
                                    Back
                                </button>
                                <button
                                    onClick={handleAddIngredientsClick}
                                    className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/25 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-afmc-maroon"
                                >
                                    <FaPlus className="text-xs" />
                                    Add Ingredients
                                </button>
                                <button
                                    onClick={handleAddToCart}
                                    disabled={hasOutOfStockIngredient}
                                    className="inline-flex items-center gap-2 rounded-full bg-afmc-maroon px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-afmc-gold/30 transition hover:bg-afmc-maroon/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-afmc-maroon disabled:cursor-not-allowed disabled:bg-stone-300"
                                >
                                    <FaSave className="text-xs" />
                                    {isEditingCartItem ? "Save Customization" : fromBuyFlow ? "Save Ingredients" : "Add to Cart"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 border-t border-stone-200 bg-white p-4 md:grid-cols-3">
                        <div className="rounded-xl border border-stone-200 bg-white p-3">
                            <p className="text-xs text-stone-500">Item Code</p>
                            <h3 className="mt-1 text-xl font-semibold text-stone-900">{item.ITEM_CODE || "571"}</h3>
                        </div>
                        <div className="rounded-xl border border-stone-200 bg-white p-3">
                            <p className="text-xs text-stone-500">Ingredients</p>
                            <h3 className="mt-1 text-xl font-semibold text-stone-900">{item.details?.length || 0}</h3>
                        </div>
                        {/* <div className="rounded-xl border border-afmc-gold/20 bg-gradient-to-br from-white to-afmc-gold/5 p-3">
                            <p className="text-xs text-stone-500">Mode</p>
                            <h3 className="mt-1 text-xl font-semibold text-afmc-maroon">
                                {isEditingCartItem ? "Cart Edit" : fromBuyFlow ? "Buy Flow" : "Cart"}
                            </h3>
                        </div> */}
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                    <div className="border-b border-stone-200 px-5 py-4">
                        <h2 className="text-base font-semibold text-stone-900">Recipe Ingredients</h2>
                        <p className="mt-1 text-sm text-stone-500">Adjust quantities or remove ingredients before saving.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-stone-50">
                                <tr className="border-b border-stone-200">
                                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Item Code</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Item Name</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Pegs</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Quantity</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Stock Status</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Delete</th>
                                </tr>
                            </thead>
                            <tbody>
                                {item.details && item.details.map((detail, index) => {
                                    const pegs = getDetailPegs(detail);
                                    const hasQuantity = pegs !== 0 && pegs !== null;
                                    const currentQty = quantities[index] || 1;
                                    const stockQuantity = getDetailStockQuantity(detail);
                                    const requiredQuantity = getDetailRequiredQuantity(detail);
                                    const explicitStatus = getDetailStockStatus(detail);
                                    const effectiveRequired = (!isEditingCartItem && fromBuyFlow)
                                        ? Number(currentQty)
                                        : (requiredQuantity != null ? Number(requiredQuantity) : Number(currentQty));
                                    const stockStatus = explicitStatus
                                        ? explicitStatus
                                        : stockQuantity != null
                                            ? (Number(stockQuantity) >= effectiveRequired ? "In Stock" : "Out Of Stock")
                                            : "Unknown";

                                    return (
                                        <tr key={index} className="border-b border-stone-100 transition last:border-b-0 hover:bg-afmc-gold/5">
                                            <td className="px-5 py-3 text-sm text-stone-600">{getDetailItemCode(detail) || "728"}</td>
                                            <td className="px-5 py-3">
                                                <span className="text-sm font-semibold text-stone-900">{toInitCap(getDetailItemName(detail))}</span>
                                            </td>
                                            <td className="px-5 py-3 text-sm text-stone-700">{currentQty || 1}</td>
                                            <td className="px-5 py-3">
                                                {hasQuantity ? (
                                                    <div className="inline-flex items-center gap-1 rounded-xl bg-stone-50 px-2 py-1">
                                                        <button
                                                            onClick={() => updateQuantity(index, -1)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-stone-700 shadow-sm transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50"
                                                        >
                                                            <FaMinus className="text-xs" />
                                                        </button>
                                                        {/* <span className="min-w-[32px] text-center text-sm font-semibold text-stone-900">{currentQty}</span> */}
                                                        <button
                                                            onClick={() => updateQuantity(index, 1)}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md bg-afmc-maroon text-white shadow-sm transition hover:bg-afmc-maroon2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-afmc-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50"
                                                        >
                                                            <FaPlus className="text-xs" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-stone-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stockStatus === "Out Of Stock" ? "bg-red-50 text-red-600" : stockStatus === "In Stock" ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                                                    {stockStatus}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                {hasQuantity && (
                                                    <button
                                                        onClick={() => deleteIngredient(index)}
                                                        className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-600 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                                                    >
                                                        <FaTrash className="text-sm" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {(!item.details || item.details.length === 0) && (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-sm text-stone-500">
                                            No ingredients available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Ingredients Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                        <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-afmc-gold/20 bg-white shadow-2xl">
                            <div className="bg-afmc-maroon px-6 py-5 text-white">
                                <h2 className="text-xl font-semibold">Add Ingredients</h2>
                                <p className="mt-1 text-sm text-white/75">Only items that have stock are displayed here.</p>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    {/* Left side - Item Name Input and Selected Ingredients */}
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-stone-700">
                                            Item Name
                                        </label>
                                        <div className="relative mb-4">
                                            <input
                                                type="text"
                                                placeholder="Search ingredients..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-4 text-sm text-stone-800 transition focus:border-afmc-gold/50 focus:outline-none focus:ring-2 focus:ring-afmc-gold/30"
                                            />
                                            <FaSearch className="absolute left-3 top-3.5 text-stone-400" />
                                        </div>

                                        {/* Selected Ingredients */}
                                        <div className="mb-4">
                                            <h3 className="mb-2 text-sm font-semibold text-stone-700">
                                                Selected Ingredients ({selectedIngredients.length}/5)
                                            </h3>
                                            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-2">
                                                {selectedIngredients.map((ingredient, index) => (
                                                    <div key={index} className="flex items-center justify-between rounded-lg bg-white p-2 shadow-sm">
                                                        <span className="text-sm font-medium text-stone-800">{initCap(ingredient.d)}</span>
                                                        <button
                                                            onClick={() => handleRemoveSelectedIngredient(index)}
                                                            className="rounded-md p-1 text-red-600 transition hover:bg-red-50"
                                                        >
                                                            <FaTrash className="text-sm" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {selectedIngredients.length === 0 && (
                                                    <p className="px-2 py-4 text-sm italic text-stone-400">No ingredients selected</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right side - LOV Dropdown */}
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-stone-700">
                                            Available Ingredients
                                        </label>
                                        <div className="max-h-60 overflow-y-auto rounded-xl border border-stone-200">
                                            {lovLoading ? (
                                                <div className="p-4 text-center text-sm text-stone-500">
                                                    <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-afmc-gold/30 border-t-afmc-maroon"></div>
                                                    Loading ingredients...
                                                </div>
                                            ) : filteredLovData.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-stone-500">
                                                    No ingredients found
                                                </div>
                                            ) : (
                                                filteredLovData.map((ingredient, index) => (
                                                    <div
                                                        key={index}
                                                        onClick={() => handleIngredientSelect(ingredient)}
                                                        className="cursor-pointer border-b border-stone-100 p-3 transition last:border-b-0 hover:bg-afmc-gold/5"
                                                    >
                                                        <span className="text-sm font-medium text-stone-800">{initCap(ingredient.d)}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-stone-200 bg-stone-50 p-6">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="rounded-full px-6 py-2 text-sm font-semibold text-stone-600 transition hover:bg-white hover:text-stone-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddIngredients}
                                    disabled={selectedIngredients.length === 0}
                                    className="rounded-full bg-afmc-maroon px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-afmc-maroon2 disabled:cursor-not-allowed disabled:bg-stone-300"
                                >
                                    Add ({selectedIngredients.length})
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}