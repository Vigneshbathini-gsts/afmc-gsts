import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';   
import { barOrdersAPI } from '../../services/api';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
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
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Set default toDate to today's date
  // useEffect(() => {
  //   const today = new Date().toISOString().split('T')[0];
  //   setToDate(today);
  //   fetchOrderHistory(1);
  // }, []);

  const fetchOrderHistory = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page: page,
        limit: pagination.recordsPerPage
      };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const response = await barOrdersAPI.getOrderHistory(params);
      
      // Handle different response structures
      let ordersData = [];
      let paginationData = {};
      
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        ordersData = response.data.data;
        paginationData = response.data.pagination || {};
      } else if (response.data && Array.isArray(response.data)) {
        ordersData = response.data;
      } else if (Array.isArray(response)) {
        ordersData = response;
      } else {
        ordersData = [];
      }
      
      setOrders(ordersData);
      setPagination(prev => ({
        ...prev,
        currentPage: page,
        totalPages: paginationData.totalPages || 1,
        totalRecords: paginationData.totalRecords || ordersData.length,
        hasNextPage: paginationData.hasNextPage || false,
        hasPrevPage: paginationData.hasPrevPage || false
      }));
    } catch (error) {
      console.error('Error fetching order history:', error);
      alert('Failed to fetch order history');
      setOrders([]);
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
  };

  const handleFilter = () => {
    fetchOrderHistory(1);
  };

  const handleReset = () => {
    setFromDate('');
    const today = new Date().toISOString().split('T')[0];
    setToDate(today);
    fetchOrderHistory(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchOrderHistory(newPage);
    }
  };

  // Download PDF Function
  const downloadPDF = () => {
    if (!orders || orders.length === 0) {
      alert("No orders to download!");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Order History Report", 14, 20);

    // Add date range if applied
    if (fromDate || toDate) {
      doc.setFontSize(11);
      doc.text(`Period: ${fromDate || 'All'} to ${toDate || 'All'}`, 14, 30);
    }

    doc.setFontSize(12);
    doc.text(`Total Orders: ${pagination.totalRecords}`, 14, 38);

    // Table columns
    const tableColumn = ["Order  ", "Date", "Customer", "Pubmed", "Status"];
    const tableRows = [];

    orders.forEach(order => {
      const orderDate = order.order_date 
        ? new Date(order.order_date).toLocaleDateString('en-IN') 
        : 'N/A';

      tableRows.push([
        order.order_num,
        orderDate,
        order.first_name || 'N/A',
        order.pubmed_name || 'N/A',
        order.status || 'PREPARING'
      ]);
    });

    doc.autoTable({
      startY: 45,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });

    // Save the PDF
    doc.save(`Order_History_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'PARTIALLY COMPLETED':
      case 'PARTIAL':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // Ensure orders is always an array before rendering
  const safeOrders = Array.isArray(orders) ? orders : [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Order History</h2>
        
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

      {/* Date Filter */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleFilter}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Apply Filter
        </button>
        <button
          onClick={handleReset}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Reset
        </button>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order  </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pubmed</th>
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
                        {order.pubmed_name || 'N/A'}
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
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-gray-500">No orders found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600">
                Showing {((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} to{' '}
                {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)} of{' '}
                {pagination.totalRecords} orders
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg disabled:bg-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          pagination.currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg disabled:bg-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal for Order Details */}
      {modalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Order Details:  {selectedOrder.order_num}
                </h3>
                <p className="text-sm text-blue-100 mt-1">
                  Customer: {selectedOrder.first_name || 'N/A'} | 
                  Pubmed: {selectedOrder.pubmed_name || 'N/A'}
                </p>
              </div>
              <button 
                onClick={closeModal} 
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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
                          <td className="px-4 py-3 text-sm text-gray-600">{item.type}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-gray-500">No items found for this order</p>
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

export default OrderHistory;