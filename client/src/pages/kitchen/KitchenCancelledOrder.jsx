import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { barOrdersAPI } from '../../services/api';
import { exportTableToPdf } from '../../utils/pdfExport';
import {
    FaTimesCircle,
    FaSpinner,
    FaSearch,
    FaChevronLeft,
    FaChevronRight,
    FaDownload,
    FaCalendarAlt,
    FaSync,
    FaArrowLeft,
} from "react-icons/fa";

const KitchenCancelledOrder = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const dashboardPath = useMemo(() => {
        const pathname = location?.pathname || "";
        return pathname.startsWith("/bar") ? "/bar/dashboard" : "/kitchen/dashboard";
    }, [location?.pathname]);
    const [cancelledOrders, setCancelledOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [tempFromDate, setTempFromDate] = useState(''); // Temporary date for UI
    const [tempToDate, setTempToDate] = useState(''); // Temporary date for UI
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [orderItemDetails, setOrderItemDetails] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    const rowsPerPage = 10;
    // Set default dates (Today) when component mounts
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setTempFromDate(today);
        setTempToDate(today);
        setFromDate(today);
        setToDate(today);
        // Fetch orders immediately with today's date
        fetchCancelledOrders(today, today);
    }, []);

    const fetchCancelledOrders = async (startDate, endDate) => {
        setLoading(true);
        try {
            const params = {};
            if (startDate) params.fromDate = startDate;
            if (endDate) params.toDate = endDate;

            console.log("Fetching cancelled orders with params:", params);

            const response = await barOrdersAPI.getCancelledOrders(params);
            const ordersData = response.data?.data || [];

            setCancelledOrders(ordersData);
            console.log(`Loaded ${ordersData.length} cancelled orders`);
        } catch (error) {
            console.error('Error fetching cancelled orders:', error);
            alert('Failed to fetch cancelled orders');
            setCancelledOrders([]);
        } finally {
            setLoading(false);
        }
    };

    // Handle search/apply button click
    const handleApplyFilters = () => {
        setFromDate(tempFromDate);
        setToDate(tempToDate);
        fetchCancelledOrders(tempFromDate, tempToDate);
        setCurrentPage(1); // Reset to first page on new search
    };

    // Handle reset button click
    const handleReset = () => {
        const today = new Date().toISOString().split('T')[0];
        setTempFromDate(today);
        setTempToDate(today);
        setFromDate(today);
        setToDate(today);
        setSearchTerm('');
        fetchCancelledOrders(today, today);
        setCurrentPage(1);
    };

    // Frontend Search Filter (Order Num, Customer Name, Pubmed)
    const filteredAndSearchedOrders = useMemo(() => {
        let result = [...cancelledOrders];

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(order =>
                (order.order_num && order.order_num.toString().toLowerCase().includes(term)) ||
                (order.first_name && order.first_name.toLowerCase().includes(term)) ||
                (order.pubmed_name && order.pubmed_name.toLowerCase().includes(term))
            );
        }

        return result;
    }, [cancelledOrders, searchTerm]);

    // Update displayed orders
    useEffect(() => {
        setFilteredOrders(filteredAndSearchedOrders);
    }, [filteredAndSearchedOrders]);

    // Pagination
    const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
    const safeTotalPages = Math.max(1, totalPages || 0);
    const paginatedOrders = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredOrders.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredOrders, currentPage]);

    // Clamp current page when result set changes (prevents going to Page 2 of 1, etc.)
    useEffect(() => {
        setCurrentPage((prev) => {
            const next = Math.min(Math.max(prev, 1), safeTotalPages);
            return next === prev ? prev : next;
        });
    }, [safeTotalPages]);

    // Reset to page 1 when search term changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchOrderItemDetails = async (orderNumber) => {
        if (!orderNumber) return;

        setLoadingDetails(true);
        try {
            const response = await barOrdersAPI.getOrderDetailsByOrderNumber(orderNumber);
            const details = response.data?.data || [];

            setOrderItemDetails(prev => ({
                ...prev,
                [orderNumber]: details
            }));
        } catch (error) {
            console.error(`Error fetching details for order ${orderNumber}:`, error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleOrderClick = async (order) => {
        setSelectedOrder(order);
        setModalOpen(true);
        await fetchOrderItemDetails(order.order_num);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedOrder(null);
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN');
    };

    // Download PDF using exportTableToPdf utility
    const downloadPDF = () => {
        const dataToExport = filteredOrders;

        if (dataToExport.length === 0) {
            alert("No cancelled orders to download!");
            return;
        }

        // Create subtitle with filter information
        let subtitleParts = [];
        if (fromDate && toDate) {
            subtitleParts.push(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`);
        }
        if (searchTerm) {
            subtitleParts.push(`Search: ${searchTerm}`);
        }
        const subtitle = subtitleParts.join(' | ');

        // Prepare table rows
        const tableRows = dataToExport.map(order => [
            order.order_num?.toString() || '',
            order.order_date ? formatDate(order.order_date) : 'N/A',
            order.first_name || 'N/A',
            order.pubmed_name || 'N/A',
            "CANCELLED"
        ]);

        exportTableToPdf({
            mainHeader: "ARMED FORCES MEDICAL COLLEGE",
            title: "Cancelled Orders Report",
            fileName: `cancelled-orders-${new Date().toISOString().split("T")[0]}.pdf`,
            subtitle: subtitle,
            headers: [
                "Order Number",
                "Order Date",
                "Customer Name",
                "Pubmed",
                "Status"
            ],
            rows: tableRows,
            footerText: "Armed Forces Medical College - Cancelled Orders Report",
            showLogo: true,
        });
    };

    const getStatusClasses = () => {
        return "bg-red-100 text-red-700 border border-red-300";
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
            <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

            <div className="relative z-10 p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <h1 className="text-2xl font-semibold text-afmc-maroon">
                        Cancelled Orders
                    </h1>
                    <button
                        type="button"
                        onClick={() => navigate(dashboardPath)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-afmc-gold/30 text-gray-700 hover:text-afmc-maroon hover:bg-afmc-maroon/5 transition"
                      >
                        <FaArrowLeft />
                        Go To Dashboard
                    </button>
                </div>

                <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm overflow-hidden">
                {/* Filter Section */}
                <div className="px-5 py-4 border-b bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* From Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <FaCalendarAlt className="inline mr-1 text-gray-500" size={12} />
                                    From Date
                                </label>
                                <input
                                    type="date"
                                    value={tempFromDate}
                                    onChange={(e) => setTempFromDate(e.target.value)}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                />
                            </div>

                            {/* To Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <FaCalendarAlt className="inline mr-1 text-gray-500" size={12} />
                                    To Date
                                </label>
                                <input
                                    type="date"
                                    value={tempToDate}
                                    onChange={(e) => setTempToDate(e.target.value)}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 items-end">
                                <button
                                    onClick={handleApplyFilters}
                                    className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md flex-1 justify-center"
                                >
                                    <FaSearch />
                                    Apply Filters
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-3 rounded-2xl bg-gray-500 hover:bg-gray-600 text-white font-semibold flex items-center gap-2 shadow hover:shadow-md"
                                >
                                    <FaSync />
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Download Bar */}
                <div className="px-5 py-4 border-b bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Cancelled Orders List</h2>
                        <p className="text-sm text-gray-500">
                            Showing {filteredOrders.length} cancelled orders
                            {fromDate && toDate && ` from ${formatDate(fromDate)} to ${formatDate(toDate)}`}
                        </p>
                    </div>
                    <div className="flex gap-3 items-center w-full md:w-auto">
                        <div className="relative w-full md:w-80">
                            <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 text-sm" />
                            <input
                                type="text"
                                placeholder="Search by order #, customer name or pubmed..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-afmc-maroon2/20 text-sm"
                            />
                        </div>
                        <button
                            onClick={downloadPDF}
                            disabled={filteredOrders.length === 0}
                            className="px-6 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold flex items-center gap-2 shadow hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <FaDownload />
                            Download PDF
                        </button>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
                        <FaSpinner className="animate-spin text-xl" />
                        <span className="text-base font-medium">Loading cancelled orders...</span>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">
                        <FaTimesCircle className="text-5xl mx-auto mb-3 text-gray-300" />
                        <p>No cancelled orders found</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Order #</th>
                                        <th className="px-6 py-4 text-left">Date</th>
                                        <th className="px-6 py-4 text-left">Customer Name</th>
                                        <th className="px-6 py-4 text-left">Pubmed</th>
                                        <th className="px-6 py-4 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedOrders.map((order, index) => (
                                        <tr key={order.order_num || index} className="border-t border-gray-100 hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 font-semibold">
                                                <button
                                                    onClick={() => handleOrderClick(order)}
                                                    className="text-afmc-maroon hover:text-afmc-maroon2 hover:underline font-medium cursor-pointer"
                                                >
                                                    {order.order_num}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {order.order_date ? formatDate(order.order_date) : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">{order.first_name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-600">{order.pubmed_name || 'N/A'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses()}`}>
                                                    Cancelled
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-5 py-4 border-t bg-gray-50">
                            <p className="text-sm text-gray-600">
                                Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 rounded-lg border bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FaChevronLeft />
                                </button>
                                <span className="px-4 py-2 rounded-lg bg-afmc-maroon/10 text-afmc-maroon font-semibold text-sm">
                                    Page {currentPage} of {safeTotalPages}
                                </span>
                                <button
                                    onClick={() =>
                                        setCurrentPage((prev) => Math.min(prev + 1, safeTotalPages))
                                    }
                                    disabled={currentPage >= safeTotalPages}
                                    className="px-3 py-2 rounded-lg border bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modal for Order Details */}
            {modalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-gradient-to-r from-afmc-maroon to-afmc-maroon2 px-6 py-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">
                                    Cancelled Order Details: {selectedOrder.order_num}
                                </h3>
                                <p className="text-sm text-white/80 mt-1">
                                    Customer: {selectedOrder.first_name || 'N/A'} |
                                    Pubmed: {selectedOrder.pubmed_name || 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <FaTimesCircle className="text-xl" />
                            </button>
                        </div>

                        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {loadingDetails ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afmc-maroon mx-auto"></div>
                                    <p className="mt-2 text-gray-600">Loading order details...</p>
                                </div>
                            ) : orderItemDetails[selectedOrder.order_num]?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full border rounded-lg">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {orderItemDetails[selectedOrder.order_num].map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-900">{item.item_name || 'N/A'}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{item.quantity}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{item.type || 'N/A'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                                                            {item.status || 'CANCELLED'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    No items found for this order
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 px-6 py-3 border-t flex justify-end">
                            <button
                                onClick={closeModal}
                                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default KitchenCancelledOrder;
