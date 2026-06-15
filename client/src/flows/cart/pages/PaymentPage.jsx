// pages/payment/PaymentPage.jsx

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import orderService from "../../../services/orderService";
import { toInitCap } from "../../../utils/textFormat";
import afmcqrcode from "../../../assets/afmcqrcode.png"

const getPaymentModesForRole = ({ modes, roleId, pathname }) => {
    const apiModes = Array.isArray(modes) && modes.length > 0 ? modes : ["IMMEDIATE"];
    const normalizedRoleId = Number(roleId);

    if (pathname.startsWith("/attendant") || normalizedRoleId === 30) {
        return ["IMMEDIATE"];
    }

    if (normalizedRoleId === 20) {
        return ["IMMEDIATE", "CREDIT"];
    }

    return apiModes;
};

const isFreeItem = (item) => {
    const freeItemQuantity = Number(item.FREE_ITEM_QUANTITY ?? item.free_item_quantity ?? 0);
    const rowPrice = Number(item.PRICE ?? item.price ?? 0);
    return freeItemQuantity > 0 || rowPrice === 0;
};

const getDisplayMoney = (amount) =>
    Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const PaymentPage = () => {
    const [searchParams] = useSearchParams();
    const orderNumber = searchParams.get("orderNumber");
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [allowedPaymentModes, setAllowedPaymentModes] = useState(["IMMEDIATE"]);
    const [paymentMode, setPaymentMode] = useState("CREDIT");
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("Paid");
    const [error, setError] = useState("");
    const [orderItems, setOrderItems] = useState([]);

    const loadOrder = useCallback(async () => {
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

            console.log("summaryResponse", summaryResponse);
            const orderData = summaryResponse.data?.data || null;
            const paymentModes = getPaymentModesForRole({
                modes: paymentModesResponse.data?.data,
                roleId: user?.roleId,
                pathname: location.pathname,
            });

            setOrder(orderData);
            setAllowedPaymentModes(paymentModes);

            const isImmediateOnly =
                paymentModes.length === 1 && paymentModes[0] === "IMMEDIATE";

            if (isImmediateOnly) {
                setPaymentStatus("Paid");
            } else if (orderData?.paymentStatus === "Un Paid") {
                setPaymentStatus("Un Paid");
            } else {
                setPaymentStatus("Paid");
            }

            setPaymentMode((currentMode) =>
                paymentModes.includes(currentMode) ? currentMode : "IMMEDIATE"
            );
        } catch (loadError) {
            console.log(loadError);
            const loadErrorMessage = "Unable to load payment details.";
            setError(loadErrorMessage);
            toast.error(loadErrorMessage);
        } finally {
            setLoading(false);
        }
    }, [location.pathname, orderNumber, user?.roleId]);


    const loadOrderDetails = useCallback(async () => {
        if (!orderNumber) return;

        try {
            const response = await orderService.getOrderDetailsInPayment(orderNumber);
            const responseData = response?.data?.data;
            console.log("responseData", responseData);
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
    }, [orderNumber]);

    useEffect(() => {
        loadOrder();
        loadOrderDetails();
    }, [loadOrder, loadOrderDetails]);

    const handlePaymentModeChange = (value) => {
        setPaymentMode(value);
        setPaymentStatus(value === "CREDIT" ? "Un Paid" : "Paid");
    };

    const handleCompletePayment = async () => {
        if (!orderNumber) {
            toast.error("Order number is required.");
            return;
        }

        if (paymentMode === "IMMEDIATE" && !paymentReference.trim()) {
            toast.error("Payment reference is required.");
            return;
        }

        try {
            await orderService.completePayment({
                orderNumber,
                paymentMode,
                paymentReference,
                paymentStatus,
            });

            toast.success("Payment completed successfully.");

            const basePath = location.pathname.startsWith("/attendant")
                ? "/attendant"
                : "/user";
            const amount = Number(order?.totalAmount || order?.order_total || 0);

            navigate(
                `${basePath}/invoice-report?orderNumber=${encodeURIComponent(orderNumber)}&amount=${encodeURIComponent(
                    amount.toFixed(2)
                )}`,
                {
                    replace: true,
                    state: {
                        orderNumber,
                        amount,
                    },
                }
            );
        } catch (payError) {
            console.log(payError);
            toast.error("Payment failed. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="p-10 text-center">
                {toInitCap("Loading...")}
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
        <div className="min-h-screen bg-stone-50 px-4 py-5 md:px-8">
            <div className="max-w-4xl mx-auto space-y-5">
                <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                    <div className="bg-gradient-to-r from-afmc-maroon to-afmc-maroon/85 px-6 py-5 text-white">
                        <h1 className="text-2xl font-bold tracking-tight">{toInitCap("Payment Details")}</h1>
                        <p className="mt-1 text-sm text-white/80">{toInitCap("Complete your payment information.")}</p>
                    </div>
                    <div className="grid gap-3 border-t border-stone-200 bg-white p-5 md:grid-cols-3">
                        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{toInitCap("Order Number")}</p>
                            <p className="mt-1 text-lg font-semibold text-stone-900">{orderNumber}</p>
                        </div>
                        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{toInitCap("Items")}</p>
                            <p className="mt-1 text-lg font-semibold text-stone-900">{orderItems?.length || 0}</p>
                        </div>

                        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                {toInitCap("Order Total")}
                            </p>
                            <p className="mt-1 text-lg font-semibold text-stone-900">
                                ₹ {getDisplayMoney(order?.totalAmount || 0)}
                            </p>
                        </div>

                        {/* <div className="rounded-2xl border border-afmc-gold/25 bg-gradient-to-br from-white to-afmc-gold/5 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Status</p>
                            <p className="mt-1 text-lg font-semibold text-afmc-maroon">
                                {paymentMode === "CREDIT" ? "Un Paid" : "Paid"}
                            </p>
                        </div> */}
                    </div>
                </div>





                <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                    <div className="border-b border-stone-200 bg-stone-50 px-6 py-4">
                        <h2 className="text-base font-semibold text-afmc-maroon">{toInitCap("Payment Panel")}</h2>
                    </div>

                    <div className="space-y-5 p-6">
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                {toInitCap("Payment Mode")}
                            </label>

                            <select
                                value={paymentMode}
                                onChange={(e) =>
                                    handlePaymentModeChange(e.target.value)
                                }
                                className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/15"
                            >
                                {allowedPaymentModes.map((mode) => (
                                    <option key={mode} value={mode}>
                                        {toInitCap(mode === "IMMEDIATE" ? "Immediate" : "Credit")}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {paymentMode === "IMMEDIATE" && (
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                    {toInitCap("Payment Reference")}
                                </label>

                                <input
                                    type="text"
                                    value={paymentReference}
                                    onChange={(e) =>
                                        setPaymentReference(
                                            e.target.value
                                        )
                                    }
                                    placeholder={toInitCap("Enter Transaction ID")}
                                    className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/15"
                                />
                                <div className="mt-3 flex justify-center">
                                 <img
                                 src={afmcqrcode}
                                 alt="Payment QR"
                                   className="w-48 h-48 object-contain rounded-lg border"
                                    />
                                </div>
                            </div>
                        )}

                        {paymentMode === "CREDIT" && (
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                                    {toInitCap("Payment Status")}
                                </label>

                                <input
                                    type="text"
                                    value={paymentStatus}
                                    disabled
                                    className="h-12 w-full rounded-2xl border border-stone-300 bg-stone-100 px-4 text-sm font-medium text-stone-700 outline-none"
                                />
                            </div>
                        )}

                        <div className="flex flex-wrap justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-300 transition hover:bg-stone-50"
                            >
                                {toInitCap("Back")}
                            </button>
                            <button
                                onClick={handleCompletePayment}
                                className="rounded-full bg-afmc-maroon px-7 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-afmc-gold/25 transition hover:bg-afmc-maroon/90"
                            >
                                {toInitCap("Complete")}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                    <div className="border-b border-stone-200 bg-stone-50 px-6 py-4">
                        <h2 className="text-base font-semibold text-afmc-maroon">{toInitCap("Order Items")}</h2>
                    </div>

                    <div className="overflow-x-auto p-6">
                        <table className="w-full overflow-hidden rounded-2xl border border-stone-200">
                            <thead className="bg-stone-50 text-stone-600">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-afmc-maroon">{toInitCap("Item")}</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold tracking-wider text-afmc-maroon">{toInitCap("Quantity")}</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold tracking-wider text-afmc-maroon">{toInitCap("Price")}</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold tracking-wider text-afmc-maroon">{toInitCap("Total")}</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-stone-200 bg-white">
                                {orderItems && orderItems.length > 0 ? (
                                    orderItems.map((item, index) => (
                                        <tr key={index} className="transition-colors hover:bg-afmc-gold/5">
                                            <td className="px-4 py-3 text-sm text-stone-700">
                                                {toInitCap(item.ITEM_NAME || item.item_name) || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm font-semibold text-stone-800">
                                                {item.QUANTITY || item.quantity || 0}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm font-semibold text-stone-800">
                                                ₹ {getDisplayMoney(isFreeItem(item) ? 0 : Number(item.PRICE || item.price || 0))}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm font-semibold text-stone-800">
                                                ₹ {getDisplayMoney(isFreeItem(item) ? 0 : Number(item.SUBTOTAL || item.subtotal || 0))}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="2" className="px-4 py-10 text-center text-stone-400 italic text-sm bg-stone-50">
                                            {toInitCap("No item details available for this order.")}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>            </div>

        </div>
    );
};

export default PaymentPage;
