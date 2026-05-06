import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { inventoryAPI, cartAPI } from "../../services/api";
import { FaArrowLeft, FaPlus, FaMinus, FaTrash, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";

export default function ItemDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [quantities, setQuantities] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [lovData, setLovData] = useState([]);
    const [lovLoading, setLovLoading] = useState(false);

    useEffect(() => {
        const fetchItemDetails = async () => {
            try {
                setLoading(true);
                const response = await inventoryAPI.getById(id);
                if (response.data.success) {
                    setItem(response.data.data);
                    // Initialize quantities from details
                    if (response.data.data.details) {
                        const initialQuantities = {};
                        response.data.data.details.forEach((detail, idx) => {
                            if (detail.pegs !== 0 && detail.pegs !== null) {
                                initialQuantities[idx] = detail.pegs || 1;
                            }
                        });
                        setQuantities(initialQuantities);
                    }
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
    }, [id]);

    const isCocktail = item?.SUB_CATEGORY === 14 || item?.SUB_CATEGORY === 15;

    const updateQuantity = (index, delta) => {
        setQuantities(prev => {
            const newVal = (prev[index] || 1) + delta;
            if (newVal < 1) return prev;
            return { ...prev, [index]: newVal };
        });
    };

    const deleteIngredient = (index) => {
        setQuantities(prev => {
            const newQuantities = { ...prev };
            delete newQuantities[index];
            return newQuantities;
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

        if (selectedIngredients.find(item => item.d === ingredient.d)) {
            toast.warning("Ingredient already selected");
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
            newDetails.push({
                itemName: ingredient.d,
                itemCode: ingredient.r, // Assuming r contains the item code
                pegs: 1, // Default quantity
                memberPrice: 0 // Default price, can be updated later
            });
        });

        setItem(prev => ({
            ...prev,
            details: newDetails
        }));

        // Initialize quantities for new ingredients
        const newQuantities = { ...quantities };
        const startIndex = item.details?.length || 0;
        selectedIngredients.forEach((_, index) => {
            newQuantities[startIndex + index] = 1;
        });
        setQuantities(newQuantities);

        setShowModal(false);
        setSelectedIngredients([]);
        toast.success(`${selectedIngredients.length} ingredient(s) added successfully`);
    };

    const filteredLovData = lovData.filter(item =>
        item.d.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddToCart = () => {
        const selectedIngredients = item.details
            .filter((_, idx) => quantities[idx] !== undefined)
            .map((detail, idx) => ({
                name: detail.itemName,
                quantity: quantities[idx],
                price: detail.memberPrice
            }));

        toast.success(
            `Added ${item.ITEM_NAME} to cart with ${selectedIngredients.length} ingredients`
        );


        navigate("/user/cart");
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
                    Add to cart
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
                                    const hasQuantity = detail.pegs !== 0 && detail.pegs !== null;
                                    const currentQty = quantities[index] || 1;

                                    return (
                                        <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition">
                                            <td className="py-3 px-5 text-sm text-gray-600">{detail.itemCode || '728'}</td>
                                            <td className="py-3 px-5">
                                                <span className="text-sm font-medium text-gray-800">{detail.itemName}</span>
                                            </td>
                                            <td className="py-3 px-5 text-sm text-gray-600">{detail.pegs || 1}</td>
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
                                                <span className="text-sm text-green-600">In stock</span>
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