import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaSave,
  FaHome,
  FaGift,
  FaBoxOpen,
  FaCalendarAlt,
  FaCommentDots,
  FaSortAmountUp,
  FaCalendarCheck,
} from "react-icons/fa";
import { offersAPI } from "../../services/api";

export default function OfferEdit() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Helper function for INITCAP (Proper Case)
  const toInitCap = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const [formData, setFormData] = useState({
    offerId: "",
    itemCode: "",
    itemName: "",
    offerQuantity: "",
    freeItemCode: "",
    freeItemName: "",
    freeItemQuantity: "",
    offerDate: "",
    endDate: "",
    message: "",
  });

  const [loadingOffer, setLoadingOffer] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchOfferDetails = async () => {
      try {
        setLoadingOffer(true);
        setError("");
        const res = await offersAPI.getOfferById(id);
        const offer = res.data.offer;

        setFormData({
          offerId: offer.offer_id,
          itemCode: offer.item_code,
          itemName: toInitCap(offer.item_name) || "",
          offerQuantity: offer.offer_quantity,
          freeItemCode: offer.free_item_code,
          freeItemName: toInitCap(offer.free_item) || "",
          freeItemQuantity: offer.free_item_quantity,
          offerDate: offer.offer_date ? offer.offer_date.split("T")[0] : "",
          endDate: offer.end_date ? offer.end_date.split("T")[0] : "",
          message: toInitCap(offer.message) || "",
        });
      } catch (err) {
        console.error("Fetch Offer Error:", err);
        setError(err.response?.data?.message || "Failed to fetch offer details");
      } finally {
        setLoadingOffer(false);
      }
    };

    fetchOfferDetails();
  }, [id]);

  // Handle End Date Change
  const handleEndDateChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      endDate: e.target.value,
    }));
    setError("");
    setSuccessMessage("");
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      // Validate that end date is provided
      if (!formData.endDate) {
        setError("Please select an end date");
        setSaving(false);
        return;
      }

      // Validate that end date is not before start date
      if (formData.offerDate && formData.endDate < formData.offerDate) {
        setError("End date cannot be earlier than start date");
        setSaving(false);
        return;
      }

      // Pass the end date from formData to the API
      const res = await offersAPI.updateOffer(id, {
        endDate: formData.endDate,
      });

      // Check if status code is 200 (success)
      if (res.status === 200) {
        setSuccessMessage(res.data?.message || "Offer deactivated successfully!");
        
        setTimeout(() => {
          navigate("/admin/offers");
        }, 1500);
      } else {
        setError("Unexpected response from server");
      }
    } catch (err) {
      console.error("Update Offer Error:", err);
      console.error("Error response:", err.response?.data);
      
      // Handle different error status codes
      if (err.response?.status === 400) {
        setError(err.response?.data?.message || "Invalid data provided");
      } else if (err.response?.status === 404) {
        setError("Offer not found");
      } else if (err.response?.status === 500) {
        setError("Server error. Please try again later.");
      } else {
        setError(err.response?.data?.message || "Failed to deactivate offer");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => navigate(-1);
  const handleDashboard = () => navigate("/admin/dashboard");

  if (loadingOffer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-afmc-maroon/15 border-t-afmc-maroon rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading offer details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative p-4 md:p-6">
      {/* Background Blobs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-5xl mx-auto">
        {/* Header with Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-afmc-maroon to-afmc-maroon2 text-white flex items-center justify-center shadow-lg">
                <FaGift className="text-sm md:text-base" />
              </span>
              Edit Offer
            </h1>
            <p className="text-gray-500 mt-1 text-sm md:text-base">
              Deactivate offer by setting end date
            </p>
          </div>

          <div className="flex gap-2 md:gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 md:px-5 md:py-3 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold shadow-sm transition flex items-center gap-2 text-sm md:text-base"
            >
              <FaArrowLeft className="text-xs md:text-sm" />
              Back
            </button>

            <button
              onClick={handleDashboard}
              className="px-4 py-2 md:px-5 md:py-3 rounded-2xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-semibold shadow-sm transition flex items-center gap-2 text-sm md:text-base"
            >
              <FaHome className="text-xs md:text-sm" />
              Dashboard
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-xl rounded-2xl md:rounded-3xl p-4 md:p-8 space-y-6">
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

          {/* Read-Only Fields Section */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FaBoxOpen className="text-afmc-maroon" />
              Offer Details (Read Only)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item Name - Read Only */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Item Name
                </label>
                <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <FaBoxOpen className="text-gray-400" />
                    <span className="text-gray-700">{formData.itemName || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Item Quantity - Read Only */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Item Quantity
                </label>
                <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <FaSortAmountUp className="text-gray-400" />
                    <span className="text-gray-700">{formData.offerQuantity || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Free Item Name - Read Only */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Free Item Name
                </label>
                <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <FaGift className="text-gray-400" />
                    <span className="text-gray-700">{formData.freeItemName || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Free Item Quantity - Read Only */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Free Item Quantity
                </label>
                <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <FaSortAmountUp className="text-gray-400" />
                    <span className="text-gray-700">{formData.freeItemQuantity || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Start Date - Read Only */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date
                </label>
                <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <FaCalendarAlt className="text-gray-400" />
                    <span className="text-gray-700">{formData.offerDate || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Message - Read Only */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message
                </label>
                <div className="rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <FaCommentDots className="text-gray-400 mt-1" />
                    <span className="text-gray-700">{formData.message || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Editable Fields Section */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FaCalendarCheck className="text-afmc-maroon" />
              End Offer
            </h3>

            <div className="grid grid-cols-1 gap-6">
              {/* End Date - Editable */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-afmc-maroon">
                  <FaCalendarCheck className="text-gray-400 mr-3" />
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleEndDateChange}
                    className="w-full outline-none text-gray-700 bg-transparent"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Set the end date for this offer. Status will be set to Inactive after this date.
                </p>
              </div>
            </div>
          </div>

          {/* Single Deactivate Offer Button aligned to right */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50 text-sm"
            >
              <FaSave className="text-sm" />
              {saving ? "Deactivating..." : "Deactivate Offer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}