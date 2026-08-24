import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { orderAPI } from "../../services/api";
import orderService from "../../services/orderService";
import { exportTableToPdf } from "../../utils/pdfExport";
import OrderFilters from "../../components/OrderFilters";
import OrderTable from "../../components/OrderTable";
import OrderDetailsModal from "../../components/OrderDetailsModal";
import { toInitCap } from "../../utils/textFormat";
import { FaArrowLeft, FaSearch } from "react-icons/fa";

const LEGACY_FILTER_STORAGE_KEY = "orderHistoryFilters";
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const getStoredAppUser = () => {
    try {
        const raw = localStorage.getItem("authUser");
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.username || null;
    } catch (_) {
        return null;
    }
};

const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

const formatDisplayDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const getFilterStorageKey = (appUser) =>
    `orderHistoryFilters:${appUser || "guest"}`;

const getInitialFilters = (appUser) => {
    const today = getTodayDate();
    const storageKey = getFilterStorageKey(appUser);

    try {
        sessionStorage.removeItem(LEGACY_FILTER_STORAGE_KEY);
        const storedFilters = JSON.parse(sessionStorage.getItem(storageKey) || "null");

        if (storedFilters) {
            return {
                fromDate: storedFilters.fromDate || today,
                toDate: storedFilters.toDate || today,
                username: storedFilters.username || "",
                orderNumber: storedFilters.orderNumber || "",
            };
        }
    } catch (_) {
        // Ignore invalid storage and fall back to today's filters.
    }

    return { fromDate: today, toDate: today, username: "", orderNumber: "" };
};

const OrderHistoryPage = () => {
    const appUser = useMemo(getStoredAppUser, []);
    const filterStorageKey = useMemo(() => getFilterStorageKey(appUser), [appUser]);
    const [filters, setFilters] = useState(() => getInitialFilters(appUser));
    const [orders, setOrders] = useState([]);
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [allowedPaymentModes, setAllowedPaymentModes] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError("");
            const response = await orderAPI.getUserOrderHistory({
                from: filters.fromDate || null,
                to: filters.toDate || null,
                username: filters.username?.trim() || null,
                app_user: appUser || null,
            });
            console.log("Order history response:", response.data);
            setOrders(response.data?.data || []);
        } catch (fetchError) {
            console.error("Order history fetch failed:", fetchError);
            setOrders([]);
            setError(
                fetchError?.response?.data?.message || "Unable to load order history."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (orderNumber) => {
        setSelectedOrderNumber(orderNumber);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedOrderNumber(null);
    };

    useEffect(() => {
        fetchOrders();
    }, [appUser]);

    useEffect(() => {
        sessionStorage.setItem(filterStorageKey, JSON.stringify(filters));
    }, [filterStorageKey, filters]);

    useEffect(() => {
        const fetchPaymentModes = async () => {
            try {
                const response = await orderService.getPaymentModes();
                setAllowedPaymentModes(response.data?.data || []);
            } catch (fetchError) {
                console.error("Payment modes fetch failed:", fetchError);
                setAllowedPaymentModes([]);
            }
        };

        fetchPaymentModes();
    }, []);

    const visibleOrders = useMemo(
        () => {
            let filtered = orders.filter((order) => order?.order_num != null);

            if (filters.orderNumber?.trim()) {
                const searchTerm = filters.orderNumber.trim().toLowerCase();
                filtered = filtered.filter((order) =>
                    order.order_num?.toString().toLowerCase().includes(searchTerm)
                );
            }

            return filtered;
        },
        [orders, filters.orderNumber]
    );

    const showPaymentMethod = allowedPaymentModes.length > 1;
    const totalPages = Math.max(1, Math.ceil(visibleOrders.length / pageSize));
    const pageStartIndex = (page - 1) * pageSize;
    const paginatedOrders = visibleOrders.slice(pageStartIndex, pageStartIndex + pageSize);
    const showingFrom = visibleOrders.length === 0 ? 0 : pageStartIndex + 1;
    const showingTo = Math.min(pageStartIndex + pageSize, visibleOrders.length);

    useEffect(() => {
        setPage(1);
    }, [filters.orderNumber, orders, pageSize]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const handleDownload = () => {
        if (!visibleOrders.length) {
            return;
        }

        exportTableToPdf({
            title: "Order History",
            fileName: `order-history-${getTodayDate()}.pdf`,
            subtitle: `From: ${formatDisplayDate(filters.fromDate)}   To: ${formatDisplayDate(filters.toDate)}   Order ID: ${filters.orderNumber || "All"}`,
            headers: [
                "Order Number",
                "Date",
                "Customer",
                "Order Status",
                showPaymentMethod ? "Payment Method" : null,
                "Payment Status",
                "Amount",
            ].filter(Boolean),
            rows: visibleOrders.map((order) => [
                order.order_num ?? "",
                formatDisplayDate(order.creation_date),
                toInitCap(order.first_name),
                toInitCap(order.status),
                showPaymentMethod ? toInitCap(order.payment_method) : null,
                toInitCap(order.payment_status ?? order.payment_status1),
                Number(order.subtotal ?? order.order_total ?? 0).toFixed(2),
            ].filter((value) => value !== null)),
        });
    };

    return (
        <div className="p-3 md:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl md:text-2xl font-bold">Order History</h1>
                {(location.pathname === "/user/order-status" || location.pathname === "/attendant/order-status") && (
                    <button
                        type="button"
                        onClick={() => navigate(
                            location.pathname === "/user/order-status" 
                                ? "/user/dashboard" 
                                : "/attendant/dashboard"
                        )}
                        className="flex items-center gap-2 rounded-full border border-white/60 bg-white px-3 md:px-5 py-1.5 md:py-2.5 text-gray-700 shadow hover:shadow-md ml-auto text-sm md:text-base"
                    >
                        <FaArrowLeft className="text-sm md:text-base" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                )}
            </div>

            {/* Custom Filter Section */}
            <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 md:p-4 shadow-sm">
                <div className="flex flex-wrap items-end gap-2 md:gap-3">
                    <div className="flex-1 min-w-[100px]">
                        <label className="mb-1 block text-xs md:text-sm font-medium text-gray-700">From</label>
                        <input
                            type="date"
                            value={filters.fromDate}
                            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-2 md:px-3 py-1.5 md:py-2 text-sm"
                        />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                        <label className="mb-1 block text-xs md:text-sm font-medium text-gray-700">To</label>
                        <input
                            type="date"
                            value={filters.toDate}
                            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-2 md:px-3 py-1.5 md:py-2 text-sm"
                        />
                    </div>
                    <div className="flex-[2] min-w-[140px]">
                        <label className="mb-1 block text-xs md:text-sm font-medium text-gray-700">Order Number</label>
                        <div className="flex gap-1.5 md:gap-2">
                            <input
                                type="text"
                                value={filters.orderNumber}
                                onChange={(e) => setFilters({ ...filters, orderNumber: e.target.value })}
                                placeholder="Search order number"
                                className="flex-1 rounded-lg border border-gray-300 px-2 md:px-3 py-1.5 md:py-2 text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        fetchOrders();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={fetchOrders}
                                className="flex items-center justify-center rounded-lg bg-[#5b5b5b] px-2.5 md:px-4 py-1.5 md:py-2 text-white hover:bg-[#4a4a4a] transition"
                            >
                                <FaSearch className="text-xs md:text-sm" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs md:text-sm text-gray-600">
                    {visibleOrders.length} order{visibleOrders.length === 1 ? "" : "s"} ready for export
                </div>
                <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!visibleOrders.length}
                    className="inline-flex items-center justify-center rounded-lg bg-afmc-maroon px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-afmc-maroon2 w-auto sm:min-w-[60px] md:min-w-[100px] sm:ml-auto"
                >
                    Download PDF
                </button>
            </div>

            {error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs md:text-sm text-red-700">
                    {error}
                </div>
            )}

            <OrderTable
                orders={paginatedOrders}
                loading={loading}
                onViewDetails={handleViewDetails}
                showPaymentMethod={showPaymentMethod}
            />

            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs md:text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    Showing {showingFrom} to {showingTo} of {visibleOrders.length} orders
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={pageSize}
                        onChange={(event) => setPageSize(Number(event.target.value))}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs md:text-sm"
                    >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                                {size} / page
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs md:text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Previous
                    </button>

                    <span className="font-medium text-gray-700 text-xs md:text-sm">
                        Page {page} of {totalPages}
                    </span>

                    <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page === totalPages}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs md:text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            <OrderDetailsModal
                isOpen={modalOpen}
                orderNumber={selectedOrderNumber}
                onClose={handleCloseModal}
            />
        </div>
    );
};

export default OrderHistoryPage;