import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { barOrdersAPI } from '../../services/api';

const KitchenCancelledOrder = () => {
    const [cancelledOrders, setCancelledOrders] = useState([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [orderItemDetails, setOrderItemDetails] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const fetchCancelledOrders = async () => {
        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.fromDate = fromDate;
            if (toDate) params.toDate = toDate;
            const response = await barOrdersAPI.getCancelledOrders(params);
            setCancelledOrders(response.data.data || []);
        } catch (error) {
            console.error('Error fetching cancelled orders:', error);
            alert('Failed to fetch cancelled orders');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrderItemDetails = async (orderNumber) => {
        console.log("=== fetchOrderItemDetails called ===");
        console.log("Order number:", orderNumber);
        
        setLoadingDetails(true);
        try {
            const response = await barOrdersAPI.getOrderDetailsByOrderNumber(orderNumber);
            console.log("API Response:", response);
            const details = response.data.data || [];
            console.log("Details received:", details);
            setOrderItemDetails(prev => ({ ...prev, [orderNumber]: details }));
            return details;
        } catch (error) {
            console.error(`Error fetching details for order ${orderNumber}:`, error);
            console.error("Error details:", error.response || error.message);
            return [];
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleOrderClick = async (order) => {
        console.log("=== Order clicked ===");
        console.log("Order object:", order);
        console.log("Order number:", order.order_num);
        
        setSelectedOrder(order);
        setModalOpen(true);
        await fetchOrderItemDetails(order.order_num);
    };

    const closeModal = () => {
        setModalOpen(false);
        setSelectedOrder(null);
        // Optional: Clear details when closing modal
        // setOrderItemDetails({});
    };

    const handleFilter = () => {
        fetchCancelledOrders();
    };

    const downloadPDF = () => {
        if (cancelledOrders.length === 0) {
            alert("No cancelled orders to download!");
            return;
        }

        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Cancelled Orders Report", 14, 20);

        if (fromDate || toDate) {
            doc.setFontSize(11);
            doc.text(`Period: ${fromDate || 'All'} to ${toDate || 'All'}`, 14, 30);
        }

        doc.text(`Total Cancelled Orders: ${cancelledOrders.length}`, 14, 38);

        const tableColumn = ["Order", "Date", "Customer", "Pubmed", "Status"];
        const tableRows = [];

        cancelledOrders.forEach(order => {
            const orderDate = order.order_date
                ? new Date(order.order_date).toLocaleDateString('en-IN')
                : 'N/A';

            tableRows.push([
                order.order_num,
                orderDate,
                order.first_name || 'N/A',
                order.pubmed_name || 'N/A',
                "Cancelled"
            ]);
        });

        doc.autoTable({
            startY: 48,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [220, 38, 38] },
        });

        doc.save(`Cancelled_Orders_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-red-700">Cancelled Orders</h2>

                <button
                    onClick={downloadPDF}
                    disabled={cancelledOrders.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 disabled:bg-gray-400"
                >
                    ↓ Download PDF
                </button>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium mb-1">From Date</label>
                    <input 
                        type="date" 
                        value={fromDate} 
                        onChange={(e) => setFromDate(e.target.value)} 
                        className="border border-gray-300 rounded px-3 py-2" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">To Date</label>
                    <input 
                        type="date" 
                        value={toDate} 
                        onChange={(e) => setToDate(e.target.value)} 
                        className="border border-gray-300 rounded px-3 py-2" 
                    />
                </div>
                <button 
                    onClick={handleFilter} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                    Apply Filter
                </button>
                <button 
                    onClick={() => { setFromDate(''); setToDate(''); fetchCancelledOrders(); }} 
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                    Reset
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-red-50">
                        <tr>
                            <th className="px-6 py-3 text-left">Order</th>
                            <th className="px-6 py-3 text-left">Date</th>
                            <th className="px-6 py-3 text-left">Customer</th>
                            <th className="px-6 py-3 text-left">Pubmed</th>
                            <th className="px-6 py-3 text-left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cancelledOrders.map((order) => (
                            <tr key={order.order_num} className="border-t hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleOrderClick(order)}
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                                    >
                                        {order.order_num}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    {order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN') : 'N/A'}
                                </td>
                                <td className="px-6 py-4">{order.first_name || 'N/A'}</td>
                                <td className="px-6 py-4">{order.pubmed_name || 'N/A'}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                                        Cancelled
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {cancelledOrders.length === 0 && !loading && (
                    <p className="text-center py-8 text-gray-500">No cancelled orders found</p>
                )}
            </div>

            {/* Modal */}
            {modalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-red-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    Order Details: {selectedOrder.order_num}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Customer: {selectedOrder.first_name || 'N/A'} | 
                                    Pubmed: {selectedOrder.pubmed_name || 'N/A'}
                                </p>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {loadingDetails ? (
                                <div className="text-center py-8">Loading...</div>
                            ) : orderItemDetails[selectedOrder.order_num]?.length > 0 ? (
                                <table className="min-w-full border">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Item Name</th>
                                            <th className="px-4 py-2 text-left">Quantity</th>
                                            <th className="px-4 py-2 text-left">Type</th>
                                            <th className="px-4 py-2 text-left">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orderItemDetails[selectedOrder.order_num].map((item, index) => (
                                            <tr key={index} className="border-b">
                                                <td className="px-4 py-2">{item.item_name}</td>
                                                <td className="px-4 py-2">{item.quantity}</td>
                                                <td className="px-4 py-2">{item.type}</td>
                                                <td className="px-4 py-2">{item.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8">No items found</div>
                            )}
                        </div>
                        <div className="bg-gray-50 px-6 py-3 border-t flex justify-end">
                            <button onClick={closeModal} className="bg-gray-500 text-white px-4 py-2 rounded-lg">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KitchenCancelledOrder;