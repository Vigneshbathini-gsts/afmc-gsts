import { useNavigate, useLocation } from "react-router-dom";
import { FaPencilAlt } from "react-icons/fa";

const formatOrderDate = (dateStr) => {
    if (!dateStr) return "-";

    try {
        // Handle format: 01/21/2026 (MM/DD/YYYY)
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr.trim())) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString();
            }
        }

        // Handle format: 2026-04-24 07:10:39 or 2026-04-24T07:10:39
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr.trim())) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString();
            }
        }

        return "-";
    } catch (e) {
        return "-";
    }
};

const OrderTable = ({
    orders = [],
    loading = false,
    onViewDetails,
    showPaymentMethod = true,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const columnCount = showPaymentMethod ? 8 : 7;

    return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                        <th className="px-4 py-3">Order Number</th>
                        <th className="px-4 py-3">Order Date</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Order Status</th>

                        {showPaymentMethod && (
                            <th className="px-4 py-3">Payment Method</th>
                        )}
                        <th className="px-4 py-3">Payment Status</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Payment</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                    {loading ? (
                        <tr>
                            <td colSpan={columnCount} className="px-4 py-8 text-center text-gray-500">
                                Loading orders...
                            </td>
                        </tr>
                    ) : orders.length === 0 ? (
                        <tr>
                            <td colSpan={columnCount} className="px-4 py-8 text-center text-gray-500">
                                No orders found.
                            </td>
                        </tr>
                    ) : (
                        orders.map((order) => {
                            const amount = order.subtotal ?? order.order_total ?? 0;
                            const paymentStatus = order.payment_status ?? order.payment_status1 ?? "-";
                            const isPaid = String(paymentStatus).trim().toLowerCase() === "paid";

                            return (
                                <tr key={order.order_num} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-blue-600 hover:text-blue-800">
                                        <button
                                            type="button"
                                            onClick={() => onViewDetails(order.order_num)}
                                            className="text-left font-medium"
                                        >
                                            {order.order_num}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        {formatOrderDate(order.order_date)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{order.first_name || "-"}</td>
                                    <td className="px-4 py-3 text-gray-600">{order.status || "-"}</td>

                                    {showPaymentMethod && (
                                        <td className="px-4 py-3 text-gray-600">{order.payment_method || "-"}</td>
                                    )}
                                    <td className="px-4 py-3 text-gray-600">{paymentStatus}</td>
                                    <td className="px-4 py-3 text-gray-600">₹ {amount}</td>
                                    <td className="px-4 py-3 flex flex-wrap gap-2">
                                        <FaPencilAlt
                                            onClick={() => {
                                                if (isPaid) return;

                                                navigate(
                                                    `${location.pathname.startsWith("/attendant") ? "/attendant" : "/user"}/payment?orderNumber=${encodeURIComponent(order.order_num)}`
                                                );
                                            }}
                                            className={`transition ${
                                                isPaid
                                                    ? "cursor-not-allowed text-gray-300"
                                                    : "cursor-pointer text-green-600 hover:text-green-700"
                                            }`}
                                            title={isPaid ? "Payment completed" : "Go to payment"}
                                        />
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default OrderTable;
