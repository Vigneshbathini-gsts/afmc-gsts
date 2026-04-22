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
  // INITCAP FUNCTION (LIKE ORACLE SQL)
  // =========================
  const initCap = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // =========================
  // FETCH OFFERS WITH INITCAP
  // =========================
  const fetchOffers = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await offersAPI.getAllOffers();
      const offersData = res.data.offers || [];
      console.log("Raw Offers Data:", offersData);
      const initcapOffers = offersData.map(offer => ({
        offer_id: initCap(offer.offer_id?.toString()) || "",
        item_name: initCap(offer.item_name) || "",
        item_code: initCap(offer.item_code) || "",
        free_item: initCap(offer.free_item) || "",
        free_item_code: initCap(offer.free_item_code) || "",
        message: initCap(offer.message) || "",
        status: offer.status, // Don't apply initCap to status - keep as is from backend
        offer_quantity: offer.offer_quantity,
        free_item_quantity: offer.free_item_quantity,
        offer_date: offer.offer_date,
        end_date: offer.end_date,
      }));
      setOffers(initcapOffers);
    } catch (err) {
      console.error("Fetch Offers Error:", err);
      setError(initCap(err.response?.data?.message) || "Failed To Fetch Offers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  // =========================
  // SEARCH FILTER (CASE-INSENSITIVE)
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
  // RESET PAGE WHEN SEARCH CHANGES
  // =========================
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // =========================
  // PAGINATION LOGIC
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
  // DATE FORMAT
  // =========================
  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("En-In");
  };

  // =========================
  // NAVIGATION
  // =========================
  const handleBack = () => navigate(-1);
  const handleCreate = () => navigate("/admin/offers/create");
  const handleEdit = (id) => navigate(`/admin/offers/edit/${id}`);

  // =========================
  // PAGE NUMBER BUTTONS
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

  const activeCount = offers.filter(
    (o) => o.status?.toLowerCase() === "active"
  ).length;

  const scheduledCount = offers.filter(
    (o) => o.status?.toLowerCase() === "scheduled"
  ).length;

  const inactiveCount = offers.filter(
    (o) => o.status?.toLowerCase() === "inactive"
  ).length;

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "scheduled":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "inactive":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative p-6 md:p-8">
      {/* Background Blobs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-afmc-maroon to-afmc-maroon2 text-white flex items-center justify-center shadow-lg">
                <FaGift />
              </span>
              Offers Management
            </h1>
            <p className="text-gray-500 mt-2">
              Create, Manage, And Update Promotional Offers
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
              className="px-5 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold shadow-md transition flex items-center gap-2"
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
              <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-afmc-maroon">
                <FaSearch className="text-gray-400 mr-3" />
                <input
                  type="text"
                  placeholder="Search By Item, Free Item, Message, Status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full outline-none text-gray-700 bg-transparent"
                />
              </div>
            </div>

            {/* Summary - Fixed counts */}
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-3 rounded-2xl bg-afmc-maroon/5 border border-afmc-maroon/10 text-sm text-gray-700 shadow-sm">
                <span className="font-semibold text-afmc-maroon">
                  {offers.length}
                </span>{" "}
                Total Offers
              </div>

              <div className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm text-gray-700 shadow-sm">
                <span className="font-semibold text-emerald-600">
                  {activeCount}
                </span>{" "}
                Active
              </div>

              <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-gray-700 shadow-sm">
                <span className="font-semibold text-slate-600">
                  {inactiveCount}
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
              <div className="w-12 h-12 border-4 border-afmc-maroon/15 border-t-afmc-maroon rounded-full animate-spin mx-auto mb-4"></div>
              Loading Offers...
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-afmc-maroon/10 text-afmc-maroon flex items-center justify-center text-3xl mb-4">
                <FaTag />
              </div>
              <h3 className="text-xl font-semibold text-gray-800">
                No Offers Found
              </h3>
              <p className="text-gray-500 mt-2">
                {search
                  ? "Try A Different Search Keyword."
                  : "Create Your First Offer To Get Started."}
              </p>

              {!search && (
                <button
                  onClick={handleCreate}
                  className="mt-6 px-5 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold shadow-md transition inline-flex items-center gap-2"
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
                      <th className="px-5 py-4 font-semibold">Offer Id</th>
                      <th className="px-5 py-4 font-semibold">Item Name</th>
                      <th className="px-5 py-4 font-semibold">Free Item</th>
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
                        className={`border-b border-gray-100 hover:bg-afmc-maroon/5 transition ${index % 2 === 0 ? "bg-white/30" : "bg-white/10"
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

                        <td className="px-5 py-4 text-gray-700 font-medium">
                          {offer.free_item || "-"}
                        </td>

                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                          {formatDate(offer.offer_date)}
                        </td>

                        <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                          {formatDate(offer.end_date)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusStyle(
                              offer.status
                            )}`}
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
                  To{" "}
                  <span className="font-semibold text-gray-800">
                    {endItem}
                  </span>{" "}
                  Of{" "}
                  <span className="font-semibold text-afmc-maroon">
                    {filteredOffers.length}
                  </span>{" "}
                  Offers
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
                      className={`w-10 h-10 rounded-xl font-semibold transition ${currentPage === page
                          ? "bg-afmc-maroon text-white shadow-md"
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