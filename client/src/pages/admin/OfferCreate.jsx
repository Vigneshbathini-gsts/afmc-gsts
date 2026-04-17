import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaSave,
  FaHome,
  FaGift,
  FaBoxOpen,
  FaCalendarAlt,
  FaCommentDots,
  FaSortAmountUp,
  FaChevronDown,
} from "react-icons/fa";
import { offersAPI } from "../../services/api";

export default function OfferCreate() {
  const navigate = useNavigate();

  const itemDropdownRef = useRef(null);
  const freeItemDropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    itemCode: "",
    itemName: "",
    offerQuantity: "",
    freeItemCode: "",
    freeItemName: "",
    freeItemQuantity: "",
    offerDate: "",
    message: "",
  });

  const [items, setItems] = useState([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showFreeItemDropdown, setShowFreeItemDropdown] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch Items for Dropdown
  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      setError("");
      const res = await offersAPI.getAllItemsForOffer();
      setItems(res.data.items || []);
    } catch (err) {
      console.error("Fetch Items Error:", err);
      setError("Failed to fetch item list");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) {
        setShowItemDropdown(false);
      }
      if (freeItemDropdownRef.current && !freeItemDropdownRef.current.contains(event.target)) {
        setShowFreeItemDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle Input Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
    setSuccessMessage("");
  };

  // Select Item from Dropdown
  const handleSelectItem = (item) => {
    setFormData((prev) => ({
      ...prev,
      itemCode: item.item_code,
      itemName: item.item_name,
    }));
    setShowItemDropdown(false);
  };

  // Select Free Item from Dropdown
  const handleSelectFreeItem = (item) => {
    setFormData((prev) => ({
      ...prev,
      freeItemCode: item.item_code,
      freeItemName: item.item_name,
    }));
    setShowFreeItemDropdown(false);
  };

  // Save Offer
  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      // Validations
      if (!formData.itemCode) {
        setError("Please select Item Name");
        return;
      }

      if (!formData.offerQuantity || Number(formData.offerQuantity) <= 0) {
        setError("Please enter valid Item Quantity");
        return;
      }

      if (!formData.freeItemCode) {
        setError("Please select Free Item Name");
        return;
      }

      if (!formData.freeItemQuantity || Number(formData.freeItemQuantity) <= 0) {
        setError("Please enter valid Free Item Quantity");
        return;
      }

      if (!formData.offerDate) {
        setError("Please select Start Date");
        return;
      }

      // Prepare payload with snake_case for backend
      const payload = {
        item_code: formData.itemCode,
        offer_quantity: parseInt(formData.offerQuantity, 10),
        free_item_code: formData.freeItemCode,
        free_item_quantity: parseInt(formData.freeItemQuantity, 10),
        offer_date: formData.offerDate,
        message: formData.message || "",
      };

      console.log("Sending payload:", payload);

      const response = await offersAPI.createOffer(payload);
      console.log("Response:", response.data);

      setSuccessMessage("Offer created successfully!");

      setTimeout(() => {
        navigate("/admin/offers");
      }, 1500);
    } catch (err) {
      console.error("Create Offer Error:", err);
      console.error("Error response:", err.response?.data);
      setError(err.response?.data?.message || "Failed to create offer");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => navigate(-1);
  const handleDashboard = () => navigate("/admin/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative p-6 md:p-8">
      {/* Background Blobs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-afmc-maroon to-afmc-maroon2 text-white flex items-center justify-center shadow-lg">
                <FaGift />
              </span>
              Create Offer
            </h1>
            <p className="text-gray-500 mt-2">
              Create promotional offers for AFMC items
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBack}
              className="px-5 py-3 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold shadow-sm transition flex items-center gap-2"
            >
              <FaArrowLeft />
              Back
            </button>

            <button
              onClick={handleDashboard}
              className="px-5 py-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold shadow-sm transition flex items-center gap-2"
            >
              <FaHome />
              Dashboard
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-xl rounded-3xl p-6 md:p-8 space-y-6">
          {successMessage && (
            <div className="bg-green-100 text-green-700 text-sm px-4 py-3 rounded-2xl border border-green-200">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-100 text-red-700 text-sm px-4 py-3 rounded-2xl border border-red-200">
              {error}
            </div>
          )}

          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Name Dropdown */}
            <div className="relative" ref={itemDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Item Name <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowItemDropdown(!showItemDropdown)}
                className="w-full flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm text-left"
              >
                <div className="flex items-center gap-3">
                  <FaBoxOpen className="text-gray-400" />
                  <span className={formData.itemName ? "text-gray-700" : "text-gray-400"}>
                    {formData.itemName || "Select item"}
                  </span>
                </div>
                <FaChevronDown className="text-gray-400" />
              </button>

              {showItemDropdown && (
                <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                  {loadingItems ? (
                    <div className="px-4 py-3 text-sm text-gray-500">Loading items...</div>
                  ) : items.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                  ) : (
                    items.map((item) => (
                      <button
                        key={item.item_code}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="w-full text-left px-4 py-3 hover:bg-afmc-maroon/5 transition border-b border-gray-100 last:border-b-0"
                      >
                        <p className="font-medium text-gray-800">{item.item_name}</p>
                       
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Item Quantity */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Item Quantity <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <FaSortAmountUp className="text-gray-400 mr-3" />
                <input
                  type="number"
                  name="offerQuantity"
                  value={formData.offerQuantity}
                  onChange={handleChange}
                  placeholder="Enter item quantity"
                  className="w-full outline-none text-gray-700 bg-transparent"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free Item Dropdown */}
            <div className="relative" ref={freeItemDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Free Item Name <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowFreeItemDropdown(!showFreeItemDropdown)}
                className="w-full flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm text-left"
              >
                <div className="flex items-center gap-3">
                  <FaGift className="text-gray-400" />
                  <span className={formData.freeItemName ? "text-gray-700" : "text-gray-400"}>
                    {formData.freeItemName || "Select free item"}
                  </span>
                </div>
                <FaChevronDown className="text-gray-400" />
              </button>

              {showFreeItemDropdown && (
                <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto">
                  {loadingItems ? (
                    <div className="px-4 py-3 text-sm text-gray-500">Loading items...</div>
                  ) : items.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                  ) : (
                    items.map((item) => (
                      <button
                        key={item.item_code}
                        type="button"
                        onClick={() => handleSelectFreeItem(item)}
                        className="w-full text-left px-4 py-3 hover:bg-afmc-maroon/5 transition border-b border-gray-100 last:border-b-0"
                      >
                        <p className="font-medium text-gray-800">{item.item_name}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Free Item Quantity */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Free Item Quantity <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <FaSortAmountUp className="text-gray-400 mr-3" />
                <input
                  type="number"
                  name="freeItemQuantity"
                  value={formData.freeItemQuantity}
                  onChange={handleChange}
                  placeholder="Enter free item quantity"
                  className="w-full outline-none text-gray-700 bg-transparent"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <FaCalendarAlt className="text-gray-400 mr-3" />
                <input
                  type="date"
                  name="offerDate"
                  value={formData.offerDate}
                  onChange={handleChange}
                  className="w-full outline-none text-gray-700 bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Message
            </label>
            <div className="flex rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <FaCommentDots className="text-gray-400 mr-3 mt-1" />
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={4}
                placeholder="Enter offer message (optional)..."
                className="w-full outline-none text-gray-700 bg-transparent resize-none"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold py-3 rounded-2xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <FaSave />
              {saving ? "Creating..." : "Create Offer"}
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
            >
              <FaArrowLeft />
              Back
            </button>

            <button
              type="button"
              onClick={handleDashboard}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold py-3 rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
            >
              <FaHome />
              Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
