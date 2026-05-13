// pages/payment/PaymentPage.jsx

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import orderService from "../../services/orderService";

const PaymentPage = () => {
    const [searchParams] = useSearchParams();
    const orderNumber = searchParams.get("orderNumber");
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [allowedPaymentModes, setAllowedPaymentModes] = useState(["IMMEDIATE"]);
    const [paymentMode, setPaymentMode] = useState("IMMEDIATE");
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("Paid");
    const [error, setError] = useState("");
    const [orderItems, setOrderItems] = useState([]);

    useEffect(() => {
        loadOrder();
        loadOrderDetails();
    }, [orderNumber]);

    const loadOrder = async () => {
        if (!orderNumber) {
            setError("Order number is required.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");

            const [summaryResponse, paymentModesResponse] = await Promise.all([
                orderService.getOrderSummary(orderNumber),
                orderService.getPaymentModes(),
            ]);

            const orderData = summaryResponse.data?.data || null;
            const paymentModes = paymentModesResponse.data?.data || ["IMMEDIATE"];



            setOrder(orderData);
            setAllowedPaymentModes(paymentModes);

            if (orderData?.paymentStatus === "Un Paid") {
                setPaymentStatus("Un Paid");
            } else {
                setPaymentStatus("Paid");
            }

            if (!paymentModes.includes(paymentMode)) {
                setPaymentMode("IMMEDIATE");
            }
        } catch (loadError) {
            console.log(loadError);
            setError("Unable to load payment details.");
        } finally {
            setLoading(false);
        }
    };


    const loadOrderDetails = async () => {
        if (!orderNumber) return;

        try {
            const response = await orderService.getOrderDetailsInPayment(orderNumber);
            const responseData = response?.data?.data;
            const orderDetails = Array.isArray(responseData)
                ? responseData
                : responseData?.items || [];
            setOrderItems(orderDetails);
            // console.log("Order Details Response:", orderDetails);
        } catch (error) {
            console.error("Failed to load order details:", error);
            setOrderItems([]);
            // We don't set global error here to allow payment processing even if item details fail
        }
    };

    const handlePaymentModeChange = (value) => {
        setPaymentMode(value);
        setPaymentStatus(value === "CREDIT" ? "Un Paid" : "Paid");
    };

    const handleCompletePayment = async () => {
        if (!orderNumber) {
            alert("Order number is required.");
            return;
        }

        if (paymentMode === "IMMEDIATE" && !paymentReference.trim()) {
            alert("Payment reference is required.");
            return;
        }

        try {
            await orderService.completePayment({
                orderNumber,
                paymentMode,
                paymentReference,
                paymentStatus,
            });

            const basePath = location.pathname.startsWith("/attendant")
                ? "/attendant"
                : "/user";
            const amount = Number(order?.totalAmount || order?.order_total || 0);

            navigate(
                `${basePath}/invoice-report?orderNumber=${encodeURIComponent(orderNumber)}&amount=${encodeURIComponent(
                    amount.toFixed(2)
                )}`,
                {
                    state: {
                        orderNumber,
                        amount,
                    },
                }
            );
        } catch (payError) {
            console.log(payError);
            alert("Payment failed. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="p-10 text-center">
                Loading...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-10 text-center text-red-600">
                {error}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-8">
                <h1 className="text-3xl font-bold mb-8">
                    Payment Page
                </h1>

                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div>
                        <p className="text-gray-500 text-sm">
                            Order Number
                        </p>

                        <p className="font-semibold text-lg">
                            {orderNumber}
                        </p>
                    </div>

                    <div>
                        <p className="text-gray-500 text-sm">
                            Total Amount
                        </p>

                        <p className="font-semibold text-lg">
                            ₹ {order?.totalAmount}
                        </p>
                    </div>
                </div>



                <div className="mb-6">
                    <label className="block mb-2 font-medium">
                        Payment Mode
                    </label>

                    <select
                        value={paymentMode}
                        onChange={(e) =>
                            handlePaymentModeChange(e.target.value)
                        }
                        className="w-full border rounded-xl px-4 py-3"
                    >
                        {allowedPaymentModes.map((mode) => (
                            <option key={mode} value={mode}>
                                {mode === "IMMEDIATE" ? "Immediate" : "Credit"}
                            </option>
                        ))}
                    </select>
                </div>

                {paymentMode === "IMMEDIATE" && (
                    <div className="mb-6">
                        <label className="block mb-2 font-medium">
                            Payment Reference
                        </label>

                        <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) =>
                                setPaymentReference(
                                    e.target.value
                                )
                            }
                            placeholder="Enter Transaction ID"
                            className="w-full border rounded-xl px-4 py-3"
                        />
                    </div>
                )}

                {paymentMode === "CREDIT" && (
                    <div className="mb-10">
                        <label className="block mb-2 font-medium">
                            Payment Status
                        </label>

                        <input
                            type="text"
                            value={paymentStatus}
                            disabled
                            className="w-full border rounded-xl px-4 py-3 bg-gray-100"
                        />
                    </div>
                )}
                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-8 py-3 rounded-xl"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleCompletePayment}
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl"
                    >
                        Complete Payment
                    </button>
                </div>
                <div className="mb-8 overflow-x-auto">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700 border-b pb-2">Order Items</h2>
                    <table className="w-full border-collapse border border-gray-200 shadow-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="border border-gray-200 px-4 py-3 text-left text-xs font-bold   tracking-wider">Item</th>
                                <th className="border border-gray-200 px-4 py-3 text-center text-xs font-bold   tracking-wider">Quantity</th>
                                <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold   tracking-wider">Price</th>
                                <th className="border border-gray-200 px-4 py-3 text-right text-xs font-bold   tracking-wider">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {orderItems && orderItems.length > 0 ? (
                                orderItems.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="border border-gray-200 px-4 py-3 text-sm text-gray-700">
                                            {item.ITEM_NAME || item.item_name || "-"}
                                        </td>
                                        <td className="border border-gray-200 px-4 py-3 text-center text-sm text-gray-700">
                                            {item.QUANTITY || item.quantity || 0}
                                        </td>
                                        <td className="border border-gray-200 px-4 py-3 text-right text-sm text-gray-700">
                                            ₹ {Number(item.PRICE || item.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="border border-gray-200 px-4 py-3 text-right text-sm text-gray-900 font-semibold">
                                            ₹ {Number(item.SUBTOTAL || item.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="border border-gray-200 px-4 py-10 text-center text-gray-400 italic text-sm bg-gray-50">
                                        No item details available for this order.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default PaymentPage;
