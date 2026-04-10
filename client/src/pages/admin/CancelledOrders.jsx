import React, { useCallback, useEffect, useState } from "react";
import { FaSearch, FaUndoAlt, FaBan, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { cancelledOrdersAPI } from "../../services/api";
import OrderDetailsModal from "../../components/OrderDetailsModal";

export default function CancelledOrders() {
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    fromDate: today,
    toDate: today,
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

  const fetchCancelledOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await cancelledOrdersAPI.getCancelledOrders(filters);
      setOrders(res.data.data || []);
      setCurrentPage(1); // reset to first page on new fetch
    } catch (error) {
      console.error("Error fetching cancelled orders:", error);
      alert("Failed to load cancelled orders report");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCancelledOrders();
  }, [fetchCancelledOrders]);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCancelledOrders();
  };

  const handleReset = () => {
    setFilters({
      fromDate: today,
      toDate: today,
    });
    setTimeout(() => {
      fetchCancelledOrders();
    }, 100);
  };

  // Pagination logic
  const totalPages = Math.ceil(orders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentOrders = orders.slice(startIndex, endIndex);

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
    <div className="p-4 min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#d70652] to-[#ff4f81] rounded-2xl shadow-md p-4 mb-5 text-white">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FaBan />
          Cancelled Orders Report
        </h1>
        <p className="text-sm text-pink-100 mt-1">
          View fully cancelled food orders
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
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d70652]"
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
              onChange={handleChange}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d70652]"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-[#d70652] hover:bg-[#b30545] text-white text-sm px-4 py-2 rounded-md transition flex items-center gap-2"
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

          {/* Rows per page */}
          {/* <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">
              Rows Per Page
            </label>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d70652]"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div> */}
        </div>
      </form>

      {/* Report Table */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-2">
          <h2 className="text-lg font-semibold text-slate-700">
            Cancelled Orders List
          </h2>
          <p className="text-sm text-slate-500">
            Showing {orders.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(endIndex, orders.length)} of {orders.length} records
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading report...</p>
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
                          className="border px-3 py-2 text-[#d70652] font-semibold cursor-pointer hover:underline"
                          onClick={() => openOrderDetails(row.ORDER_NUM)}
                        >
                          {row.ORDER_NUM}
                        </td>
                        <td className="border px-3 py-2">
                          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
                            {row.status}
                          </span>
                        </td>
                        <td className="border px-3 py-2">{row.ORDER_DATE}</td>
                        <td className="border px-3 py-2">{row.FIRST_NAME}</td>
                        <td className="border px-3 py-2">{row.pubmed_name}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="border px-3 py-4 text-center text-slate-500"
                      >
                        No cancelled orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {orders.length > 0 && (
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
                            ? "bg-[#d70652] text-white border-[#d70652]"
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
