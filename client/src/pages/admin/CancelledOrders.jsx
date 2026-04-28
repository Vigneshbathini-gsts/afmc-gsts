import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaSearch, FaUndoAlt, FaBan, FaChevronLeft, FaChevronRight, FaArrowLeft, FaDownload, FaTimes } from "react-icons/fa";
import { cancelledOrdersAPI } from "../../services/api";
import OrderDetailsModal from "../../components/OrderDetailsModal";
import { useNavigate } from "react-router-dom";
import { exportTableToPdf } from "../../utils/pdfExport";

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
    console.log("Opening details for order:", orderNumber);
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
    
    // Fetch immediately after reset
    setTimeout(() => {
      fetchCancelledOrders(nextFilters);
    }, 100);
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
        order?.ORDER_DATE ?? "",
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
    <div className="p-4 min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2">
      {/* Back Button */}
      <div className="flex justify-end mb-4 gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition duration-300"
        >
          <FaDownload size={14} />
          Download Pdf
        </button>
        <button
          onClick={() => navigate("/admin/dashboard")}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-afmc-maroon to-afmc-maroon2 hover:from-afmc-maroon2 hover:to-afmc-maroon text-white font-medium rounded-lg shadow-md transition duration-300"
        >
          <FaArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaBan />
          Cancelled Orders Report
        </h1>
        <p className="text-sm text-white/80 mt-1">
          View Fully Cancelled Food Orders
        </p>
      </div>

      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="bg-white rounded-2xl shadow-sm p-4 mb-5"
      >
        <div className="grid md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">
              From Date
            </label>
            <input
              type="date"
              name="fromDate"
              value={filters.fromDate}
              onChange={handleDateChange}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-afmc-maroon"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">
              To Date
            </label>
            <input
              type="date"
              name="toDate"
              value={filters.toDate}
              onChange={handleDateChange}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-afmc-maroon"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-afmc-maroon hover:bg-afmc-maroon2 text-white text-sm px-4 py-2 rounded-md transition flex items-center gap-2"
            >
              <FaSearch />
              Search
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="bg-slate-500 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-md transition flex items-center gap-2"
            >
              <FaUndoAlt />
              Reset
            </button>
          </div>
        </div>
      </form>

      {/* Report Table */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
          <h2 className="text-lg font-semibold text-slate-700">
            Cancelled Orders List
          </h2>

          {/* Combined Search Input with Cancel Icon */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              name="searchTerm"
              value={searchFilters.searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by Order Number or Customer Name..."
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-afmc-maroon pr-10"
            />
            {searchFilters.searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FaTimes size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Records Info - Below the title and search */}
        <div className="mb-3">
          <p className="text-sm text-slate-500">
            Showing {filteredOrders.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} Records
            {orders.length !== filteredOrders.length && (
              <span className="text-slate-400 ml-2">
                (filtered from {orders.length} total)
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading Report...</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border border-slate-200 text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border px-3 py-2 text-left">Order No</th>
                    <th className="border px-3 py-2 text-left">Status</th>
                    <th className="border px-3 py-2 text-left">Order Date</th>
                    <th className="border px-3 py-2 text-left">Customer Name</th>
                    <th className="border px-3 py-2 text-left">Pubmed</th>
                  </tr>
                </thead>
                <tbody>
                  {currentOrders.length > 0 ? (
                    currentOrders.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td
                          className="border px-3 py-2 text-afmc-maroon font-semibold cursor-pointer hover:underline"
                          onClick={() => openOrderDetails(row.ORDER_NUM)}
                        >
                          {row.ORDER_NUM}
                        </td>
                        <td className="border px-3 py-2">
                          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                            {toInitCap(row.status)}
                          </span>
                        </td>
                        <td className="border px-3 py-2">{row.ORDER_DATE}</td>
                        <td className="border px-3 py-2">{toInitCap(row.FIRST_NAME)}</td>
                        <td className="border px-3 py-2">{toInitCap(row.pubmed_name)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="border px-3 py-4 text-center text-slate-500"
                      >
                        No Cancelled Orders Found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredOrders.length > 0 && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-5">
                <p className="text-sm text-slate-500">
                  Page {currentPage} of {totalPages || 1}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Previous */}
                  <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <FaChevronLeft size={12} />
                    Prev
                  </button>

                  {/* Page Numbers */}
                  {[...Array(totalPages)].map((_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => handlePageChange(pageNumber)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${currentPage === pageNumber
                            ? "bg-afmc-maroon text-white border-afmc-maroon"
                            : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
                          }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  {/* Next */}
                  <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {/* Modal */}
      <OrderDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orderNumber={selectedOrderNumber}
      />
    </div>
  );
}
