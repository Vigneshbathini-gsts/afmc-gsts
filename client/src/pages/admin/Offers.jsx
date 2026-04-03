import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlusCircle,
  FaArrowLeft,
  FaSearch,
  FaEdit,
  FaGift,
  FaTag,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { offersAPI } from "../../services/api";

export default function Offers() {
  const navigate = useNavigate();

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // =========================
  // Fetch Offers
  // =========================
  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await offersAPI.getAllOffers();
      setOffers(res.data.offers || []);
    } catch (err) {
      console.error("Fetch Offers Error:", err);
      setError(err.response?.data?.message || "Failed to fetch offers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  // =========================
  // Search Filter
  // =========================
  const filteredOffers = useMemo(() => {
    if (!search.trim()) return offers;

    const term = search.toLowerCase();

    return offers.filter((offer) =>
      [
        offer.offer_id,
        offer.item_name,
        offer.item_code,
        offer.free_item,
        offer.free_item_code,
        offer.message,
        offer.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [offers, search]);

  // =========================
  // Reset page when search changes
  // =========================
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // =========================
  // Pagination Logic
  // =========================
  const totalPages = Math.ceil(filteredOffers.length / itemsPerPage);

  const paginatedOffers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOffers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOffers, currentPage]);

  const startItem =
    filteredOffers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredOffers.length);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  const handlePageClick = (page) => {
    setCurrentPage(page);
  };

  // =========================
  // Date Format
  // =========================
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN");
  };

  // =========================
  // Navigation
  // =========================
  const handleBack = () => navigate(-1);
  const handleCreate = () => navigate("/admin/offers/create");
  const handleEdit = (id) => navigate(`/admin/offers/edit/${id}`);

  // =========================
  // Page Number Buttons
  // =========================
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative p-6 md:p-8">
      {/* Background Blobs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#d70652]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#ff025e]/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-[#d70652] text-white flex items-center justify-center shadow-lg">
                <FaGift />
              </span>
              Offers Management
            </h1>
            <p className="text-gray-500 mt-2">
              Create, manage, and update promotional offers
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
              onClick={handleCreate}
              className="px-5 py-3 rounded-2xl bg-[#d70652] hover:bg-[#b00543] text-white font-semibold shadow-md transition flex items-center gap-2"
            >
              <FaPlusCircle />
              Create Offer
            </button>
          </div>
        </div>

        {/* Search + Summary */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-xl rounded-3xl p-5 md:p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search */}
            <div className="w-full lg:max-w-md">
              <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-[#d70652]">
                <FaSearch className="text-gray-400 mr-3" />
                <input
                  type="text"
                  placeholder="Search by item, free item, message, status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full outline-none text-gray-700 bg-transparent"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-3 rounded-2xl bg-pink-50 border border-pink-100 text-sm text-gray-700 shadow-sm">
                <span className="font-semibold text-[#d70652]">
                  {offers.length}
                </span>{" "}
                Total Offers
              </div>

              <div className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm text-gray-700 shadow-sm">
                <span className="font-semibold text-emerald-600">
                  {
                    offers.filter(
                      (o) => o.status?.toLowerCase() === "active"
                    ).length
                  }
                </span>{" "}
                Active
              </div>

              <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-gray-700 shadow-sm">
                <span className="font-semibold text-slate-600">
                  {
                    offers.filter(
                      (o) => o.status?.toLowerCase() !== "active"
                    ).length
                  }
                </span>{" "}
                Inactive
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-xl rounded-3xl overflow-hidden">
          {/* Error */}
          {error && (
            <div className="m-6 bg-red-100 text-red-700 text-sm px-4 py-3 rounded-2xl border border-red-200">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="p-10 text-center text-gray-500">
              <div className="w-12 h-12 border-4 border-pink-200 border-t-[#d70652] rounded-full animate-spin mx-auto mb-4"></div>
              Loading offers...
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-pink-100 text-[#d70652] flex items-center justify-center text-3xl mb-4">
                <FaTag />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">
                No offers found
              </h3>
              <p className="text-gray-500 mt-2">
                {search
                  ? "Try a different search keyword."
                  : "Create your first offer to get started."}
              </p>

              {!search && (
                <button
                  onClick={handleCreate}
                  className="mt-6 px-5 py-3 rounded-2xl bg-[#d70652] hover:bg-[#b00543] text-white font-semibold shadow-md transition inline-flex items-center gap-2"
                >
                  <FaPlusCircle />
                  Create Offer
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-white/70 border-b border-gray-200">
                    <tr className="text-gray-700">
                      <th className="px-5 py-4 font-semibold">Action</th>
                      <th className="px-5 py-4 font-semibold">Offer ID</th>
                      <th className="px-5 py-4 font-semibold">Item Name</th>
                      <th className="px-5 py-4 font-semibold">Item Code</th>
                      <th className="px-5 py-4 font-semibold">Buy Qty</th>
                      <th className="px-5 py-4 font-semibold">Free Item</th>
                      <th className="px-5 py-4 font-semibold">Free Qty</th>
                      <th className="px-5 py-4 font-semibold">Offer Date</th>
                      <th className="px-5 py-4 font-semibold">End Date</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Message</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedOffers.map((offer, index) => (
                      <tr
                        key={offer.offer_id}
                        className={`border-b border-gray-100 hover:bg-pink-50/50 transition ${
                          index % 2 === 0 ? "bg-white/30" : "bg-white/10"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleEdit(offer.offer_id)}
                            className="w-10 h-10 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition shadow-sm"
                            title="Edit Offer"
                          >
                            <FaEdit />
                          </button>
                        </td>

                        <td className="px-5 py-4 font-semibold text-gray-800">
                          {offer.offer_id}
                        </td>

                        <td className="px-5 py-4 text-gray-700 font-medium">
                          {offer.item_name || "-"}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {offer.item_code || "-"}
                        </td>

                        <td className="px-5 py-4 text-gray-700">
                          {offer.offer_quantity || "-"}
                        </td>

                        <td className="px-5 py-4 text-gray-700 font-medium">
                          {offer.free_item || "-"}
                        </td>

                        <td className="px-5 py-4 text-gray-700">
                          {offer.free_item_quantity || "-"}
                        </td>

                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                          {formatDate(offer.offer_date)}
                        </td>

                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                          {formatDate(offer.end_date)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                              offer.status?.toLowerCase() === "active"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {offer.status || "Inactive"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-gray-700 min-w-[280px]">
                          {offer.message || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-5 bg-white/50 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing{" "}
                  <span className="font-semibold text-gray-800">
                    {startItem}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-gray-800">
                    {endItem}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-[#d70652]">
                    {filteredOffers.length}
                  </span>{" "}
                  offers
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
                  >
                    <FaChevronLeft />
                  </button>

                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageClick(page)}
                      className={`w-10 h-10 rounded-xl font-semibold transition ${
                        currentPage === page
                          ? "bg-[#d70652] text-white shadow-md"
                          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition"
                  >
                    <FaChevronRight />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}