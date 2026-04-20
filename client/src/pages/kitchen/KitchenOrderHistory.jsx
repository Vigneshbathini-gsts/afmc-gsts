import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { barOrdersAPI } from '../../services/api';

const KitchenOrderHistory = () => {
  const [orders, setOrders] = useState([]);           // All orders from API
  const [filteredOrders, setFilteredOrders] = useState([]); // Displayed orders after search
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [orderItemDetails, setOrderItemDetails] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Set default dates
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFromDate(today);
    setToDate(today);
  }, []);

  // Fetch orders from API (only dates + pagination)
  const fetchOrderHistory = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.recordsPerPage,
      };

      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      // NO search param sent to backend

      console.log("Fetching orders with params:", params);

      const response = await barOrdersAPI.getOrderHistory(params);
      console.log("API Response:", response?.data);

      let ordersData = [];
      let paginationData = {};

      if (response?.data?.data && Array.isArray(response.data.data)) {
        ordersData = response.data.data;
        paginationData = response.data.pagination || {};
      } else if (response?.data && Array.isArray(response.data)) {
        ordersData = response.data;
      }

      setOrders(ordersData);

      setPagination(prev => ({
        ...prev,
        currentPage: page,
        totalPages: paginationData.totalPages || 
                   Math.ceil((paginationData.totalRecords || ordersData.length) / prev.recordsPerPage) || 1,
        totalRecords: paginationData.totalRecords || ordersData.length,
        hasNextPage: paginationData.hasNextPage ?? (page < (paginationData.totalPages || 1)),
        hasPrevPage: paginationData.hasPrevPage ?? (page > 1)
      }));

    } catch (error) {
      console.error('Error fetching order history:', error);
      alert('Failed to fetch order history');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Frontend Search + Filter Logic
  const filteredAndSearchedOrders = useMemo(() => {
    let result = [...orders];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();

      result = result.filter(order => 
        (order.order_num && order.order_num.toString().toLowerCase().includes(term)) ||
        (order.first_name && order.first_name.toLowerCase().includes(term)) ||
        (order.phone_number && order.phone_number.toLowerCase().includes(term))
      );
    }

    return result;
  }, [orders, searchTerm]);

  // Update displayed orders when search or API data changes
  useEffect(() => {
    setFilteredOrders(filteredAndSearchedOrders);
  }, [filteredAndSearchedOrders]);

  // Fetch when dates change
  useEffect(() => {
    if (fromDate && toDate) {
      fetchOrderHistory(1);
    }
  }, [fromDate, toDate]);

  const fetchOrderItemDetails = async (orderNumber) => {
    if (!orderNumber) return;

    setLoadingDetails(true);
    try {
      const response = await barOrdersAPI.getOrderHistoryItemDetails(orderNumber);
      
      let details = [];
      let summary = null;

      if (response?.data?.data) {
        details = response.data.data.items || response.data.data;
        summary = response.data.data.summary || null;
      } else if (Array.isArray(response?.data)) {
        details = response.data;
      }

      setOrderItemDetails(prev => ({
        ...prev,
        [orderNumber]: { items: details, summary }
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

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchOrderHistory(newPage);
    }
  };

  // Download PDF (uses filtered orders if search is active)
  const downloadPDF = () => {
    const dataToExport = searchTerm ? filteredOrders : orders;

    if (!dataToExport || dataToExport.length === 0) {
      alert("No orders to download!");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Order History Report", 14, 20);

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

    doc.text(`Total Orders: ${dataToExport.length}`, 14, yOffset);
    yOffset += 12;

    const tableColumn = ["Order Number", "Order Date", "Name", "Phone Number", "Subtotal", "Status"];
    const tableRows = dataToExport.map(order => [
      order.order_num,
      order.order_date ? new Date(order.order_date).toLocaleDateString('en-IN') : 'N/A',
      order.first_name || 'N/A',
      order.phone_number || 'N/A',
      `Rs. ${order.subtotal || '0.00'}`,
      order.status || 'PREPARING'
    ]);

    doc.autoTable({
      startY: yOffset,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    doc.save(`Order_History_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'PARTIALLY COMPLETED':
      case 'PARTIAL': return 'bg-orange-100 text-orange-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const safeOrders = filteredOrders;   // Use filtered orders for display

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Kitchen Order History</h2>

        <button
          onClick={downloadPDF}
          disabled={!safeOrders.length}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 disabled:bg-gray-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download PDF
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by order #, name or phone..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-xl leading-none"
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

          <div className="flex gap-2">
            <button
              onClick={() => fetchOrderHistory(1)}
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

      <div className="mb-4 text-sm text-gray-600">
        Showing {safeOrders.length} orders | Total Records: {pagination.totalRecords}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading orders...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {safeOrders.map((order) => (
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
                        {order.phone_number || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          ₹{order.subtotal || '0'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                          {order.status || 'PREPARING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {safeOrders.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-gray-500">No orders found matching your search</p>
              </div>
            )}
          </div>

          {/* Note: Pagination is disabled for now since we're filtering on frontend */}
          {/* If you want full pagination + search, backend support is needed */}
        </>
      )}

      {/* Modal remains same as before */}
      {modalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Order Details: #{selectedOrder.order_num}
                </h3>
                <p className="text-sm text-blue-100 mt-1">
                  Customer: {selectedOrder.first_name || 'N/A'} | 
                  Phone: {selectedOrder.phone_number || 'N/A'}
                </p>
              </div>
              <button onClick={closeModal} className="text-white hover:text-gray-200">
                ✕
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading order details...</p>
                </div>
              ) : orderItemDetails[selectedOrder.order_num]?.items?.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preparation Charges</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {orderItemDetails[selectedOrder.order_num].items.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{item.item_name || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.type || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              ₹{item.pr_charges ? parseFloat(item.pr_charges).toFixed(2) : '0.00'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              ₹{item.subtotal ? parseFloat(item.subtotal).toFixed(2) : '0.00'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.status?.toUpperCase() === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                item.status?.toUpperCase() === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {item.status || 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
                    <div className="bg-gray-50 rounded-lg p-4 min-w-[300px]">
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-lg font-bold text-gray-900">Grand Total:</span>
                        <span className="text-xl font-bold text-blue-600">
                          ₹{orderItemDetails[selectedOrder.order_num].summary?.totalAmount 
                            ? parseFloat(orderItemDetails[selectedOrder.order_num].summary.totalAmount).toFixed(2)
                            : orderItemDetails[selectedOrder.order_num].items
                                .reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0)
                                .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">No items found for this order</div>
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

export default KitchenOrderHistory;