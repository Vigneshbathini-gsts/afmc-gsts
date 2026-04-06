import React, { useCallback, useEffect, useState } from "react";
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

  // Fetch Offer Details by ID
  const fetchOfferDetails = useCallback(async () => {
    try {
      setLoadingOffer(true);
      setError("");
      const res = await offersAPI.getOfferById(id);
      const offer = res.data.offer;


      setFormData({
        offerId: offer.offer_id,
        itemCode: offer.item_code,
        itemName: offer.item_name || "",
        offerQuantity: offer.offer_quantity,
        freeItemCode: offer.free_item_code,
        freeItemName: offer.free_item || "",
        freeItemQuantity: offer.free_item_quantity,
        offerDate: offer.offer_date ? offer.offer_date.split('T')[0] : "",
        endDate: offer.end_date ? offer.end_date.split('T')[0] : "",
        message: offer.message || "",
      });

    } catch (err) {
      console.error("Fetch Offer Error:", err);
      setError(err.response?.data?.message || "Failed to fetch offer details");
    } finally {
      setLoadingOffer(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOfferDetails();
  }, [fetchOfferDetails]);

  // Handle End Date Change
  const handleEndDateChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      endDate: e.target.value,
    }));
    setError("");
    setSuccessMessage("");
  };

  // Update Offer (Only End Date, Status set to 'Inactive' in backend)
  const handleUpdate = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");




      setSuccessMessage("Offer deactivated successfully!");

      setTimeout(() => {
        navigate("/admin/offers");
      }, 1500);
    } catch (err) {
      console.error("Update Offer Error:", err);
      console.error("Error response:", err.response?.data);
      setError(err.response?.data?.message || "Failed to update offer");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => navigate(-1);
  const handleDashboard = () => navigate("/admin/dashboard");

  if (loadingOffer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-200 border-t-[#d70652] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading offer details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative p-6 md:p-8">
      {/* Background Blobs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#d70652]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#ff025e]/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-[#d70652] text-white flex items-center justify-center shadow-lg">
                <FaGift />
              </span>
              Edit  Offer
            </h1>
           
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

          {/* Read-Only Fields Section */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FaBoxOpen className="text-[#d70652]" />
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
              <FaCalendarCheck className="text-[#d70652]" />
              End Offer
            </h3>

            <div className="grid grid-cols-1 gap-6">
              {/* End Date - Editable */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-[#d70652]">
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
                  Set the end date for this offer. Status will be set to Inactive.
                </p>
              </div>
            </div>
          </div>

         

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="flex-1 bg-[#d70652] hover:bg-[#b00543] text-white font-semibold py-3 rounded-2xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FaSave />
              {saving ? "Deactivating..." : "Deactivate Offer"}
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
