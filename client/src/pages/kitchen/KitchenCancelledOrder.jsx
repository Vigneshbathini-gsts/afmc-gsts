import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { barOrdersAPI } from '../../services/api';

const KitchenCancelledOrder = () => {
    const [cancelledOrders, setCancelledOrders] = useState([]); // Original data from API
    const [filteredOrders, setFilteredOrders] = useState([]);   // After search
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [orderItemDetails, setOrderItemDetails] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Set default dates (Today) when component mounts
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setFromDate(today);
        setToDate(today);
    }, []);

    // Fetch cancelled orders when dates change
    useEffect(() => {
        if (fromDate && toDate) {
            fetchCancelledOrders();
        }
    }, [fromDate, toDate]);

    const fetchCancelledOrders = async () => {
        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.fromDate = fromDate;
            if (toDate) params.toDate = toDate;

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

    const handleReset = () => {
        const today = new Date().toISOString().split('T')[0];
        setFromDate(today);
        setToDate(today);
        setSearchTerm('');
    };

    // Download PDF using currently filtered orders
    const downloadPDF = () => {
        const dataToExport = searchTerm ? filteredOrders : cancelledOrders;

        if (dataToExport.length === 0) {
            alert("No cancelled orders to download!");
            return;
        }

        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Cancelled Orders Report", 14, 20);

        let yOffset = 30;
        doc.setFontSize(11);

        if (fromDate || toDate) {
            doc.text(`Period: ${fromDate || 'All'} to ${toDate || 'All'}`, 14, yOffset);
            yOffset += 8;
        }
        if (searchTerm) {
            doc.text(`Search: ${searchTerm}`, 14, yOffset);
            yOffset += 8;
        }

        doc.text(`Total Cancelled Orders: ${dataToExport.length}`, 14, yOffset);
        yOffset += 12;

        const tableColumn = ["Order", "Date", "Customer", "Pubmed", "Status"];
        const tableRows = dataToExport.map(order => [
            order.order_num,
            order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN') : 'N/A',
            order.first_name || 'N/A',
            order.pubmed_name || 'N/A',
            "Cancelled"
        ]);

        doc.autoTable({
            startY: yOffset,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [220, 38, 38] },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        doc.save(`Cancelled_Orders_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-red-700">Cancelled Orders</h2>

                <button
                    onClick={downloadPDF}
                    disabled={filteredOrders.length === 0}
                    className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 disabled:bg-gray-400 transition-colors"
                >
                    ↓ Download PDF
                </button>
            </div>

            {/* Filter Section */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    {/* Search */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1 text-gray-700">Search</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by order #, customer name or pubmed..."
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-xl"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    {/* From Date */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={fetchCancelledOrders}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors flex-1"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={handleReset}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="mb-4 text-sm text-gray-600">
                Showing {filteredOrders.length} cancelled orders
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading cancelled orders...</p>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead className="bg-red-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pubmed</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredOrders.map((order) => (
                                    <tr key={order.order_num} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => handleOrderClick(order)}
                                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                                            >
                                                {order.order_num}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {order.first_name || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {order.pubmed_name || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                                                Cancelled
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredOrders.length === 0 && !loading && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">No cancelled orders found</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {modalOpen && selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="bg-red-50 px-6 py-4 border-b flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    Cancelled Order Details: {selectedOrder.order_num}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Customer: {selectedOrder.first_name || 'N/A'} | 
                                    Pubmed: {selectedOrder.pubmed_name || 'N/A'}
                                </p>
                            </div>
                            <button 
                                onClick={closeModal} 
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {loadingDetails ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
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
                                                    <td className="px-4 py-3">{item.item_name || 'N/A'}</td>
                                                    <td className="px-4 py-3">{item.quantity}</td>
                                                    <td className="px-4 py-3">{item.type || 'N/A'}</td>
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
    );
};

export default KitchenCancelledOrder;