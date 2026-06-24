import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaSearch } from "react-icons/fa";
import { orderAPI } from "../../services/api";
import orderService from "../../services/orderService";
import { exportTableToPdf } from "../../utils/pdfExport";
import OrderDetailsModal from "../../components/OrderDetailsModal";
import { toInitCap } from "../../utils/textFormat";

const getStatusClassName = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();
    if (normalizedStatus === "cancelled") return "text-red-600";
    if (normalizedStatus === "completed") return "text-green-600";
    if (normalizedStatus === "received") return "text-blue-600";
    if (normalizedStatus === "preparing") return "text-amber-500";
    return "text-gray-500";
};

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
    const navigate = useNavigate();
    const appUser = useMemo(getStoredAppUser, []);
    const filterStorageKey = useMemo(() => getFilterStorageKey(appUser), [appUser]);
    const [filters, setFilters] = useState(() => getInitialFilters(appUser));
    const [orders, setOrders] = useState([]);
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
            // console.log("Order history response:", response.data);
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
            subtitle: `From: ${formatDisplayDate(filters.fromDate)}   To: ${formatDisplayDate(filters.toDate)}   Order #: ${filters.orderNumber || "All"}`,
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
        <div className="min-h-screen w-full bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative overflow-hidden">
            <div className="absolute top-16 left-10 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl"></div>
            <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl"></div>

            <div className="relative z-10 w-full max-w-full px-0 py-4 md:p-8">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-800">Order History</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            View your complete order history and export records as needed.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 rounded-full border border-white/60 bg-white px-5 py-2.5 text-gray-700 shadow hover:shadow-md"
                    >
                        <FaArrowLeft />
                        Back
                    </button>
                </div>

                <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur-sm">
                    <div className="mb-6 flex flex-wrap items-end gap-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                From
                            </label>
                            <input
                                type="date"
                                value={filters.fromDate}
                                onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                To
                            </label>
                            <input
                                type="date"
                                value={filters.toDate}
                                onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={fetchOrders}
                            className="flex items-center gap-2 rounded-2xl bg-[#5b5b5b] px-6 py-3 font-semibold text-white shadow hover:shadow-md"
                        >
                            <FaSearch />
                            Search
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={!visibleOrders.length}
                            className="flex items-center gap-2 rounded-2xl bg-afmc-maroon px-6 py-3 font-semibold text-white shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Download PDF
                        </button>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-4 py-4">
                            <div className="flex flex-1 items-center gap-3">
                                <FaSearch className="text-gray-400" />
                                <input
                                    type="text"
                                    value={filters.orderNumber}
                                    onChange={(e) => setFilters({ ...filters, orderNumber: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            fetchOrders();
                                        }
                                    }}
                                    placeholder="Search order number..."
                                    className="w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-700 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={fetchOrders}
                                    className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-700"
                                >
                                    Go
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                                {error}
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Order Number</th>
                                        <th className="px-4 py-3 text-left font-medium">Order Date</th>
                                        <th className="px-4 py-3 text-left font-medium">Customer</th>
                                        {showPaymentMethod && <th className="px-4 py-3 text-left font-medium">Payment Method</th>}
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                        <th className="px-4 py-3 text-left font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={showPaymentMethod ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                                                Loading order history...
                                            </td>
                                        </tr>
                                    ) : paginatedOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={showPaymentMethod ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                                                No orders found.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedOrders.map((order) => (
                                            <tr
                                                key={order.order_num}
                                                className="border-t border-gray-100 hover:bg-gray-50"
                                            >
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetails(order.order_num)}
                                                        className="font-semibold text-[#0077b6] hover:underline"
                                                    >
                                                        {order.order_num}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {formatDisplayDate(order.creation_date)}
                                                </td>
                                                <td className="px-4 py-3">{toInitCap(order.first_name)}</td>
                                                {showPaymentMethod && <td className="px-4 py-3">{toInitCap(order.payment_method)}</td>}
                                                <td className="px-4 py-3">
                                                    <span className={`font-semibold ${getStatusClassName(order.status)}`}>
                                                        {toInitCap(order.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">${Number(order.subtotal ?? order.order_total ?? 0).toFixed(2)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 px-4 py-4 text-sm text-gray-600">
                            <div>
                                Showing {showingFrom} to {showingTo} of {visibleOrders.length} orders
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="rounded-lg border border-gray-300 bg-white px-3 py-2"
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
                                    className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <span className="font-medium text-gray-700">
                                    Page {page} of {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                                    disabled={page === totalPages}
                                    className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
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
