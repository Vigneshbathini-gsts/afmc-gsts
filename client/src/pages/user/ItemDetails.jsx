import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { inventoryAPI, cartAPI } from "../../services/api";
import { FaArrowLeft, FaPlus, FaMinus, FaTrash, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";

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

const isUnknownStockStatus = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    return !normalized || normalized === "unknown";
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [quantities, setQuantities] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [lovData, setLovData] = useState([]);
    const [lovLoading, setLovLoading] = useState(false);

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

                    // For buy-flow edits, prefilled ingredients often don't carry live stock data.
                    // Enrich them using the cart stock endpoint so status matches cart flow.
                    if (!isEditingCartItem && fromBuyFlow && Array.isArray(details) && details.length > 0) {
                        try {
                            const codes = details
                                .map((detail) => Number(getDetailItemCode(detail)))
                                .filter((code) => Number.isFinite(code) && code > 0);
                            if (codes.length > 0) {
                                const stockRes = await cartAPI.getIngredientStocks(codes, buyOrderNumber);
                                const stockMap = stockRes?.data?.data || {};
                                details = details.map((detail) => {
                                    const itemCode = Number(getDetailItemCode(detail));
                                    const stockQuantity = stockMap?.[String(itemCode)];
                                    if (stockQuantity === undefined) return normalizeDetail(detail);
                                    return normalizeDetail({
                                        ...detail,
                                        stockQuantity,
                                        stockStatus: isUnknownStockStatus(getDetailStockStatus(detail))
                                            ? (Number(stockQuantity) > 0 ? "In Stock" : "Out Of Stock")
                                            : getDetailStockStatus(detail),
                                    });
                                });
                            }
                        } catch (err) {
                            console.warn("Could not enrich ingredient stocks:", err);
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
    }, [cartId, draftKey, id, isEditingCartItem, prefillDetails]);

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
                    toast.error(`${itemName} available quantity: ${stockQuantity}`);
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

    const deleteIngredient = (index) => {
        setItem((prev) => {
            const newDetails = (prev.details || []).filter((_, idx) => idx !== index);
            const newQuantities = {};
            Object.entries(quantities).forEach(([key, value]) => {
                const idx = Number(key);
                if (idx === index) return;
                const newIndex = idx > index ? idx - 1 : idx;
                newQuantities[newIndex] = value;
            });
            persistCustomDetails(newDetails, newQuantities);
            setQuantities(newQuantities);
            return {
                ...prev,
                details: newDetails,
            };
        });

        toast.info("Ingredient removed from recipe");
    };

    const fetchLovIngredients = async () => {
        if (!item?.SUB_CATEGORY) return;

        try {
            setLovLoading(true);
            const response = await cartAPI.getLovIngredients(item.SUB_CATEGORY);
            if (response.data.success) {
                setLovData(response.data.data);
            }
        } catch (err) {
            console.error("Error fetching LOV ingredients:", err);
            toast.error("Failed to load ingredients list");
        } finally {
            setLovLoading(false);
        }
    };

    const handleAddIngredientsClick = () => {
        setShowModal(true);
        setSelectedIngredients([]);
        setSearchTerm("");
        fetchLovIngredients();
    };

    const handleIngredientSelect = (ingredient) => {
        if (selectedIngredients.length >= 3) {
            toast.warning("Maximum 3 ingredients can be selected");
            return;
        }

        const alreadySelected = selectedIngredients.some(item => item.d === ingredient.d);
        const alreadyInRecipe = item?.details?.some(
            (detail) => String(getDetailItemName(detail) || "").trim().toLowerCase() === String(ingredient.d || "").trim().toLowerCase()
                || String(getDetailItemCode(detail) || "").trim() === String(ingredient.r || "").trim()
        );

        if (alreadySelected || alreadyInRecipe) {
            toast.warning("Ingredient already exists in the recipe");
            return;
        }

        setSelectedIngredients(prev => [...prev, ingredient]);
    };

    const handleRemoveSelectedIngredient = (index) => {
        setSelectedIngredients(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddIngredients = () => {
        if (selectedIngredients.length === 0) {
            toast.warning("Please select at least one ingredient");
            return;
        }

        // Add selected ingredients to the item details with default quantity 1
        const newDetails = [...(item.details || [])];
        selectedIngredients.forEach(ingredient => {
            const rawStockQuantity = ingredient?.stockQuantity ?? ingredient?.STOCK_QUANTITY ?? ingredient?.stock_quantity ?? null;
            const stockQuantity =
                rawStockQuantity == null || rawStockQuantity === ""
                    ? null
                    : Number(rawStockQuantity);
            const stockStatusRaw = ingredient?.stockStatus ?? ingredient?.STOCK_STATUS ?? ingredient?.stock_status ?? null;
            newDetails.push({
                itemName: ingredient.d,
                itemCode: ingredient.r, // Assuming r contains the item code
                pegs: 1, // Default quantity
                memberPrice: null,
                unitPrice: ingredient.unitPrice,
                stockQuantity,
                stockStatus:
                    stockStatusRaw ||
                    (Number.isFinite(stockQuantity) && stockQuantity >= 0
                        ? (stockQuantity > 0 ? "In Stock" : "Out Of Stock")
                        : "Unknown"),
            });
        });

        const newQuantities = { ...quantities };
        const startIndex = item.details?.length || 0;
        selectedIngredients.forEach((_, index) => {
            newQuantities[startIndex + index] = 1;
        });

        setItem(prev => ({
            ...prev,
            details: newDetails
        }));
        setQuantities(newQuantities);
        persistCustomDetails(newDetails, newQuantities);

        setShowModal(false);
        setSelectedIngredients([]);
        toast.success(`${selectedIngredients.length} ingredient(s) added successfully`);
    };

    const filteredLovData = lovData.filter(item =>
        item.d.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                    toast.error(`${ing.itemName || code} available quantity: ${available}`);
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
                                    toast.error(`Out of stock. Available quantity: ${available}`);
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
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading item details...</p>
                </div>
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
                    <h2 className="text-2xl font-semibold text-gray-800 mb-4">Item Not Found</h2>
                    <p className="text-gray-600 mb-6">{error || "The requested item could not be found."}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Action Buttons - Reduced width */}
            <div className="flex gap-3 mt-6 justify-end">
                 <button
                     onClick={handleAddToCart}
                     className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-xl transition shadow-sm"
                 >
                    {isEditingCartItem ? "Save Customization" : fromBuyFlow ? "Save to Buy Flow" : "Add to cart"}
                 </button>
                <button
                    onClick={handleAddIngredientsClick}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-8 rounded-xl transition"
                >
                    Add Ingredients
                </button>
            </div>
            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Header with Back button and Go button */}
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition"
                    >
                        <FaArrowLeft />
                        Back
                    </button>

                </div>

                {/* Header Card */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
                    <div className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm text-gray-500 mb-1">Item Code {item.ITEM_CODE || '571'}</div>
                                <h1 className="text-2xl font-bold text-gray-800">{item.ITEM_NAME}</h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ingredients Table - Wider */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-4 px-5 text-xs font-medium text-gray-500 uppercase tracking-wider">Item Code</th>
                                    <th className="text-left py-4 px-5 text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                    <th className="text-left py-4 px-5 text-xs font-medium text-gray-500 uppercase tracking-wider">Pegs</th>
                                    <th className="text-left py-4 px-5 text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                    <th className="text-left py-4 px-5 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Status</th>
                                    <th className="text-left py-4 px-5 text-xs font-medium text-gray-500 uppercase tracking-wider">Delete</th>
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
                                        <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                            <td className="py-3 px-5 text-sm text-gray-600">{getDetailItemCode(detail) || '728'}</td>
                                            <td className="py-3 px-5">
                                                <span className="text-sm font-medium text-gray-800">{getDetailItemName(detail)}</span>
                                            </td>
                                            <td className="py-3 px-5 text-sm text-gray-600">{pegs || 1}</td>
                                            <td className="py-3 px-5">
                                                {hasQuantity ? (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => updateQuantity(index, -1)}
                                                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
                                                        >
                                                            <FaMinus className="text-xs" />
                                                        </button>
                                                        <span className="w-8 text-center text-sm font-medium text-gray-800">{currentQty}</span>
                                                        <button
                                                            onClick={() => updateQuantity(index, 1)}
                                                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
                                                        >
                                                            <FaPlus className="text-xs" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-5">
                                                <span className={`text-sm ${stockStatus === "Out Of Stock" ? "text-red-600" : stockStatus === "In Stock" ? "text-green-600" : "text-gray-500"}`}>
                                                    {stockStatus}
                                                </span>
                                            </td>
                                            <td className="py-3 px-5">
                                                {hasQuantity && (
                                                    <button
                                                        onClick={() => deleteIngredient(index)}
                                                        className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition"
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
                                        <td colSpan="6" className="py-8 text-center text-gray-400">
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
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                            <div className="p-6 border-b border-gray-200">
                                <h2 className="text-2xl font-bold text-gray-800">Add Ingredients</h2>
                                <p className="text-sm text-gray-600 mt-1">Note: Only items that have stock are displayed here.</p>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Left side - Item Name Input and Selected Ingredients */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Item Name
                                        </label>
                                        <div className="relative mb-4">
                                            <input
                                                type="text"
                                                placeholder="Search ingredients..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            />
                                            <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                        </div>

                                        {/* Selected Ingredients */}
                                        <div className="mb-4">
                                            <h3 className="text-sm font-medium text-gray-700 mb-2">
                                                Selected Ingredients ({selectedIngredients.length}/3)
                                            </h3>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {selectedIngredients.map((ingredient, index) => (
                                                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                                                        <span className="text-sm text-gray-800">{ingredient.d}</span>
                                                        <button
                                                            onClick={() => handleRemoveSelectedIngredient(index)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <FaTrash className="text-sm" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {selectedIngredients.length === 0 && (
                                                    <p className="text-sm text-gray-400 italic">No ingredients selected</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right side - LOV Dropdown */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Available Ingredients
                                        </label>
                                        <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                                            {lovLoading ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto mb-2"></div>
                                                    Loading ingredients...
                                                </div>
                                            ) : filteredLovData.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    No ingredients found
                                                </div>
                                            ) : (
                                                filteredLovData.map((ingredient, index) => (
                                                    <div
                                                        key={index}
                                                        onClick={() => handleIngredientSelect(ingredient)}
                                                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                    >
                                                        <span className="text-sm text-gray-800">{ingredient.d}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2 text-gray-600 hover:text-gray-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddIngredients}
                                    disabled={selectedIngredients.length === 0}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition"
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
