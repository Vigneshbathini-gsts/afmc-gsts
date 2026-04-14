import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    FaTimesCircle,
    FaSpinner,
    FaSearch,
    FaChevronLeft,
    FaChevronRight,
    FaUtensils,
    FaCocktail,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { barOrdersAPI } from "../../services/api";

export default function OutletOrders({ kitchenType = "Bar" }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    console.log("Rendering OutletOrders with kitchenType:", kitchenType);

    const navigate = useNavigate();
    const rowsPerPage = 8;

    const isKitchen = kitchenType === "Kitchen";
    const title = isKitchen ? "Kitchen Orders" : "Bar Orders";
    const description = isKitchen ? "View and manage food-related orders" : "View and manage liquor-related orders";
    const gradientFrom = isKitchen ? "from-green-600" : "from-pink-600";
    const gradientVia = isKitchen ? "via-teal-500" : "via-rose-500";
    const gradientTo = isKitchen ? "to-emerald-400" : "to-orange-400";
    const hoverBg = isKitchen ? "hover:bg-green-50/30" : "hover:bg-pink-50/30";
    const headerBg = isKitchen ? "from-gray-50 to-green-50" : "from-gray-50 to-pink-50";
    const icon = isKitchen ? <FaUtensils className="text-2xl" /> : <FaCocktail className="text-2xl" />;

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(true);
            const res = await barOrdersAPI.getOrders(kitchenType);
            setOrders(res.data || []);
        } catch (error) {
            console.error(`Error fetching ${kitchenType.toLowerCase()} orders:`, error);
        } finally {
            setLoading(false);
        }
    }, [kitchenType]);

    useEffect(() => {
        fetchOrders();
    }, [kitchenType, fetchOrders]);

    const handleOrderClick = async (order) => {
        try {
            if (order.CAN_NAVIGATE !== "Y") return;

            let updatedOrder = { ...order };

            if (order.Status1 === "Received") {
                await barOrdersAPI.updateStatus({
                    ORDERNUMBER: order.ORDERNUMBER,
                    KITCHEN: kitchenType,
                });

                updatedOrder = {
                    ...order,
                    STATUS: "Preparing",
                    Status1: "Preparing",
                    COLOR: "2-red",
                };
            }

            navigate("../order-details", {
                state: { ...updatedOrder, kitchenType: kitchenType },
            });
        } catch (error) {
            console.error("Error updating order status:", error);
            alert("Failed to open order details. Please try again.");
        }
    };

    const handleCancelClick = async (order) => {
        // Early return if order cannot be cancelled
        if (order.CAN_CANCEL !== "Y") {
            alert("This order cannot be cancelled.");
            return;
        }

        // Confirm with user before cancelling
        const confirmed = window.confirm(
            `Are you sure you want to cancel Order ${order.ORDERNUMBER}?\n\n` +
            `Customer: ${order.FIRST_NAME}\n` +
            `Status: ${order.STATUS}\n\n` +
            `This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            const resp = await barOrdersAPI.cancelOrder({
                ORDERNUMBER: order.ORDERNUMBER,
            });

            // Check response properly - handle both response.data and direct response
            const isSuccess = resp?.data?.success || resp?.success;
            const message = resp?.data?.message || resp?.message;

            if (isSuccess) {
                alert(message || `Order ${order.ORDERNUMBER} cancelled successfully.`);
                // Refresh the orders list to reflect the cancellation
                await fetchOrders(); // Assuming you have this function
            } else {
                alert(message || `Failed to cancel order ${order.ORDERNUMBER}.`);
            }
        } catch (error) {
            console.error("Error cancelling order:", error);

            // Handle different error scenarios
            if (error.response?.status === 404) {
                alert(`Order ${order.ORDERNUMBER} not found. It may have been already processed.`);
            } else if (error.response?.status === 409) {
                alert(`Order ${order.ORDERNUMBER} is currently being processed. Please try again.`);
            } else if (error.response?.data?.message) {
                alert(error.response.data.message);
            } else {
                alert(`Failed to cancel order ${order.ORDERNUMBER}. Please try again.`);
            }
        }
    };

    const getStatusClasses = (status) => {
        switch (status) {
            case "Received": return "bg-yellow-100 text-yellow-700 border border-yellow-300";
            case "Preparing": return "bg-red-100 text-red-600 border border-red-300";
            case "Completed": return "bg-green-100 text-green-700 border border-green-300";
            default: return "bg-gray-100 text-gray-600 border border-gray-300";
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const orderNo = String(order.ORDERNUMBER || "").toLowerCase();
            const firstName = String(order.FIRST_NAME || "").toLowerCase();
            const status = String(order.STATUS || "").toLowerCase();
            const search = searchTerm.toLowerCase();
            return orderNo.includes(search) || firstName.includes(search) || status.includes(search);
        });
    }, [orders, searchTerm]);

    const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
    const paginatedOrders = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredOrders.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredOrders, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="p-4 md:p-6 space-y-5">
            <div className={`bg-gradient-to-r ${gradientFrom} ${gradientVia} ${gradientTo} rounded-2xl shadow-md p-4 md:p-5 text-white`}>
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-3 rounded-xl">{icon}</div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">{title}</h1>
                        <p className="text-white/90 text-xs md:text-sm">{description}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                <div className={`px-5 py-4 border-b bg-gradient-to-r ${headerBg} flex flex-col md:flex-row md:items-center md:justify-between gap-3`}>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Orders List</h2>
                        <p className="text-sm text-gray-500">Active and completed {kitchenType.toLowerCase()} orders</p>
                    </div>
                    <div className="relative w-full md:w-80">
                        <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                            type="text"
                            placeholder="Search by order no, name, status..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
                        <FaSpinner className="animate-spin text-xl" />
                        <span className="text-base font-medium">Loading orders...</span>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="py-16 text-center text-gray-500">No {kitchenType.toLowerCase()} orders found.</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Order No</th>
                                        <th className="px-6 py-4 text-left">Ordered By</th>
                                        <th className="px-6 py-4 text-left">Status</th>
                                        <th className="px-6 py-4 text-left">Created Date</th>
                                        <th className="px-6 py-4 text-center">Cancel</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedOrders.map((order, index) => (
                                        <tr key={order.ORDERNUMBER || index} className={`border-t border-gray-100 ${hoverBg} transition`}>
                                            <td className="px-6 py-4 font-semibold">
                                                {order.CAN_NAVIGATE === "Y" ? (
                                                    <button onClick={() => handleOrderClick(order)} className={`${isKitchen ? "text-green-600 hover:text-green-800" : "text-pink-600 hover:text-pink-800"} hover:underline`}>
                                                        {order.ORDERNUMBER}
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-400 cursor-not-allowed">{order.ORDERNUMBER}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">{order.FIRST_NAME || "N/A"}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(order.STATUS)}`}>
                                                    {order.STATUS}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{order.CREATION_DATE || "N/A"}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleCancelClick(order)}
                                                    disabled={order.CAN_CANCEL !== "Y"}
                                                    className={`text-xl transition ${order.CAN_CANCEL === "Y" ? "text-red-500 hover:text-red-700" : "text-gray-300 cursor-not-allowed"}`}
                                                    title={order.CAN_CANCEL === "Y" ? "Cancel Order" : "Cancel not allowed"}
                                                >
                                                    <FaTimesCircle />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-5 py-4 border-t bg-gray-50">
                            <p className="text-sm text-gray-600">
                                Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                            </p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage((prev) => prev - 1)} disabled={currentPage === 1} className="px-3 py-2 rounded-lg border bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <FaChevronLeft />
                                </button>
                                <span className={`px-4 py-2 rounded-lg ${isKitchen ? "bg-green-100 text-green-700" : "bg-pink-100 text-pink-700"} font-semibold text-sm`}>
                                    Page {currentPage} of {totalPages || 1}
                                </span>
                                <button onClick={() => setCurrentPage((prev) => prev + 1)} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-2 rounded-lg border bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <FaChevronRight />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

