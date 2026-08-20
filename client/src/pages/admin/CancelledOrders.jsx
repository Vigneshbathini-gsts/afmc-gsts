import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaSearch, FaUndoAlt, FaBan, FaChevronLeft, FaChevronRight, FaArrowLeft, FaDownload, FaTimes } from "react-icons/fa";
import { cancelledOrdersAPI } from "../../services/api";
import OrderDetailsModal from "../../components/OrderDetailsModal";
import { useNavigate } from "react-router-dom";
import { exportTableToPdf } from "../../utils/pdfExport";
import { formatDisplayDate } from "../../utils/dateUtils";

// Helper function to convert string to INITCAP (Title Case)
const toInitCap = (str) => {
  if (!str || str === "") return "-";
  if (typeof str !== "string") str = String(str);
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function CancelledOrders() {
  const navigate = useNavigate();
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    fromDate: today,
    toDate: today,
  });

  const initialFiltersRef = useRef(filters);

  // Search filters
  const [searchFilters, setSearchFilters] = useState({
    searchTerm: "", // Combined search term
  });

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const openOrderDetails = (orderNumber) => {
    // console.log("Opening details for order:", orderNumber);
    setSelectedOrderNumber(orderNumber);
    setIsModalOpen(true);
  };

  const fetchCancelledOrders = useCallback(async (queryFilters) => {
    try {
      setLoading(true);
      const res = await cancelledOrdersAPI.getCancelledOrders(queryFilters);
      setOrders(res.data.data || []);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching cancelled orders:", error);
      alert("Failed To Load Cancelled Orders Report");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount only
  useEffect(() => {
    fetchCancelledOrders(initialFiltersRef.current);
  }, [fetchCancelledOrders]);

  // Handle date selection - only filter when a complete date is selected
  const handleDateChange = (e) => {
    const { name, value } = e.target;

    // Update the filter state
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCancelledOrders(filters);
  };

  const handleSearchChange = (e) => {
    const { value } = e.target;
    setSearchFilters({ searchTerm: value });
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleClearSearch = () => {
    setSearchFilters({ searchTerm: "" });
    setCurrentPage(1);
  };

  const handleReset = () => {
    const resetFromDate = today;
    const resetToDate = today;

    const nextFilters = {
      fromDate: resetFromDate,
      toDate: resetToDate,
    };

    setFilters(nextFilters);
    fetchCancelledOrders(nextFilters);
  };

  const handleDownload = () => {
    if (!orders.length) {
      alert("No Data To Download");
      return;
    }

    // Format date for display
    const formatDate = (dateString) => {
      if (!dateString) return "-";
      const date = new Date(dateString);
      return date.toLocaleDateString();
    };

    // Dynamic values based on current component
    exportTableToPdf({
      mainHeader: "ARMED FORCES MEDICAL COLLEGE",
      title: "Cancelled Orders Report",
      fileName: `cancelled-orders-${new Date().toISOString().split("T")[0]}.pdf`,
      subtitle: `From: ${formatDate(filters.fromDate)} To: ${formatDate(filters.toDate)}`,
      headers: [
        "Order Number",
        "Status",
        "Order Date",
        "Customer Name",
        "Pubmed"
      ],
      rows: orders.map((order) => [
        order?.ORDER_NUM ?? "",
        toInitCap(order?.status ?? ""),
        formatDisplayDate(order?.ORDER_DATE ?? ""),
        toInitCap(order?.FIRST_NAME ?? ""),
        toInitCap(order?.pubmed_name ?? ""),
      ]),
      footerText: "Armed Forces Medical College - Cancelled Orders Report",
      showLogo: true,
    });
  };

  // Filter orders based on search criteria (search in both order number and customer name)
  const filteredOrders = orders.filter((order) => {
    const searchTermLower = searchFilters.searchTerm.toLowerCase();
    if (!searchTermLower) return true;

    const matchesOrderNumber = order?.ORDER_NUM &&
      order.ORDER_NUM.toString().toLowerCase().includes(searchTermLower);

    const matchesCustomerName = order?.FIRST_NAME &&
      order.FIRST_NAME.toLowerCase().includes(searchTermLower);

    return matchesOrderNumber || matchesCustomerName;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl" />

      <div className="relative z-10 px-0 py-4 md:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-800">Cancelled Orders</h1>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-2xl bg-afmc-maroon px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-afmc-maroon2"
            >
              <FaDownload size={14} />
              Download Pdf
            </button>
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow hover:shadow-md border border-afmc-gold/30 text-gray-700 hover:text-afmc-maroon hover:bg-afmc-maroon/5 transition"
            >
              <FaArrowLeft size={14} />
              Back
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm mb-6">
          <form onSubmit={handleSearch} className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_auto] items-end gap-3 md:flex md:flex-wrap md:gap-4">
            {/* From Date */}
            <label className="w-full sm:w-auto min-w-0">
              <span className="mb-2 block text-sm font-medium text-gray-700">From</span>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 w-full">
                <input
                  type="date"
                  name="fromDate"
                  value={filters.fromDate}
                  onChange={handleDateChange}
                  className="w-full bg-transparent text-gray-800 outline-none [color-scheme:light] text-sm"
                />
              </div>
            </label>

            {/* To Date */}
            <label className="w-full sm:w-auto min-w-0">
              <span className="mb-2 block text-sm font-medium text-gray-700">To</span>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 w-full">
                <input
                  type="date"
                  name="toDate"
                  value={filters.toDate}
                  onChange={handleDateChange}
                  className="w-full bg-transparent text-gray-800 outline-none [color-scheme:light] text-sm"
                />
              </div>
            </label>

            {/* Search Input - Reduced width */}
            <div className="w-full sm:w-auto lg:w-48 xl:w-56">
              <span className="mb-2 block text-sm font-medium text-gray-700">Search</span>
              <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <input
                  type="text"
                  name="searchTerm"
                  value={searchFilters.searchTerm}
                  onChange={handleSearchChange}
                  placeholder="Order or customer"
                  className="w-full bg-transparent text-gray-800 outline-none placeholder:text-gray-400 text-sm"
                />
                {searchFilters.searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
                  >
                    <FaTimes size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons - Right aligned */}
            <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto col-span-2 sm:col-span-1">
              <button
                type="submit"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#5b5b5b] text-sm font-semibold text-white shadow hover:shadow-md px-4 md:px-6 py-3 flex-1 sm:flex-none min-w-[60px]"
                aria-label="Search cancelled orders"
              >
                <FaSearch size={14} />
                <span className="hidden sm:inline">Search</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-500 px-4 md:px-6 py-3 text-sm font-semibold text-white shadow hover:shadow-md flex-1 sm:flex-none min-w-[60px]"
              >
                <FaUndoAlt size={14} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Cancelled Orders List</h2>
              <p className="text-sm text-gray-500">
                Showing {filteredOrders.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} Records
                {orders.length !== filteredOrders.length && (
                  <span className="text-gray-400 ml-2">(filtered from {orders.length} total)</span>
                )}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-600">Loading report...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Order No</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Order Date</th>
                      <th className="px-4 py-3 text-left font-medium">Customer Name</th>
                      <th className="px-4 py-3 text-left font-medium">Pubmed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentOrders.length > 0 ? (
                      currentOrders.map((row, index) => (
                        <tr key={index} className="border-t border-gray-100 hover:bg-gray-50 text-gray-700">
                          <td
                            className="px-4 py-3 text-afmc-maroon font-semibold cursor-pointer hover:underline"
                            onClick={() => openOrderDetails(row.ORDER_NUM)}
                          >
                            {row.ORDER_NUM}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                              {toInitCap(row.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatDisplayDate(row.ORDER_DATE)}</td>
                          <td className="px-4 py-3">{toInitCap(row.FIRST_NAME)}</td>
                          <td className="px-4 py-3">{toInitCap(row.pubmed_name)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                          No Cancelled Orders Found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredOrders.length > 0 && (
                <div className="mt-5 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                  <div>Page {currentPage} of {totalPages || 1}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePrevious}
                      disabled={currentPage === 1}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FaChevronLeft size={12} />
                      Prev
                    </button>
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${currentPage === pageNumber ? "bg-afmc-maroon text-white border-afmc-maroon" : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"}`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    <button
                      onClick={handleNext}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <FaChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <OrderDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orderNumber={selectedOrderNumber}
        includeCancelled
      />
    </div>
  );
}