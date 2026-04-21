import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  FaArrowLeft,
  FaSpinner,
  FaTimesCircle,
  FaCheckCircle,
  FaCamera,
  FaHistory,
  FaCheck,
  FaBan,
  FaTrash,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, barOrdersAPI } from "../../services/api";
import { Html5Qrcode } from "html5-qrcode";

export default function OutletOrderDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const orderData = location.state;
  const { user } = useAuth();

  const department = useMemo(() => {
    if (!user) return "Bar";
    const roleName = user.outletType?.toLowerCase() || "";
    if (roleName.includes("kitchen")) return "Kitchen";
    if (roleName.includes("bar")) return "Bar";
    return "Bar";
  }, [user]);

  const [items, setItems] = useState([]);
  const [scannedItems, setScannedItems] = useState([]); // Store scanned items in state only
  const [loading, setLoading] = useState(true);
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const orderedBy = orderData?.FIRST_NAME || "";
  const [qty, setQty] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanError, setScanError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [processingScan, setProcessingScan] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [scannedCocktailData, setScannedCocktailData] = useState(null);
  const [showCocktailModal, setShowCocktailModal] = useState(false);

  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isManualScanRef = useRef(false);
  const processingScanRef = useRef(false);
  const clearOnExitStartedRef = useRef(false);

  // Fetch order items and scanned items from session
  const fetchOrderItems = useCallback(async () => {
    if (!orderData?.ORDERNUMBER) return;

    try {
      setLoading(true);
      
      // Fetch order items
      const itemsRes = await barOrdersAPI.getOrderItems({
        ORDERNUMBER: orderData.ORDERNUMBER,
        KITCHEN: department,
      });
      const itemsData = itemsRes.data?.data || itemsRes.data || [];
      
      // Fetch scanned items from session
      const scannedRes = await barOrdersAPI.getScannedItems(orderData.ORDERNUMBER);
      const scannedData = scannedRes.data?.data || [];
      
      if (isMountedRef.current) {
        setItems(itemsData);
        setScannedItems(scannedData);
      }
    } catch (error) {
      console.error("Error fetching order data:", error);
      if (isMountedRef.current) {
        setItems([]);
        setScannedItems([]);
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [orderData?.ORDERNUMBER, department]);

  useEffect(() => {
    isMountedRef.current = true;
    if (orderData?.ORDERNUMBER) {
      fetchOrderItems();
    }

    return () => {
      isMountedRef.current = false;
      if (scannerRef.current) stopScanner();
    };
  }, [orderData?.ORDERNUMBER, fetchOrderItems]);

  // Clear scanned-items session data when the tab is closed.
  // Note: browser may still cancel the request in some cases, but `keepalive` improves reliability.
  useEffect(() => {
    const orderNumber = orderData?.ORDERNUMBER;
    if (!orderNumber) return;

    const clearOnExit = () => {
      if (clearOnExitStartedRef.current) return;
      clearOnExitStartedRef.current = true;

      const token = localStorage.getItem("token");
      try {
        fetch(`${API_BASE_URL}/bar-orders/scanned-items/${orderNumber}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
          keepalive: true,
        });
      } catch (e) {
        // best-effort only
      }
    };

    window.addEventListener("pagehide", clearOnExit);
    return () => window.removeEventListener("pagehide", clearOnExit);
  }, [orderData?.ORDERNUMBER]);

  // Helper function to get scanned quantity for an item
  const getScannedQuantityByItemCode = useCallback((itemCode) => {
    return scannedItems
      .filter(item => item.itemCode === itemCode)
      .reduce((sum, item) => sum + item.scanQuantity, 0);
  }, [scannedItems]);

  // Helper function to check if barcode already scanned
  const isBarcodeScanned = useCallback((barcode) => {
    return scannedItems.some(item => item.barcode === barcode);
  }, [scannedItems]);

  const handleBarcodeBlur = async () => {
    if (barcode && barcode.trim() !== "" && !processingScanRef.current && !scanning && isManualScanRef.current) {
      isManualScanRef.current = false;
      await autoProcessScan(barcode);
    }
    isManualScanRef.current = false;
  };

  const handleBarcodeKeyPress = async (e) => {
    if (e.key === "Enter" && barcode && barcode.trim() !== "" && !processingScanRef.current && !scanning) {
      e.preventDefault();
      isManualScanRef.current = true;
      await autoProcessScan(barcode);
    }
  };

  const handleBarcodeChange = (value) => {
    setBarcode(value);
    if (value && !scanning) {
      isManualScanRef.current = true;
    }
    if (!value) {
      setItemCode("");
      setItemName("");
      setPrice("");
    }
  };

 const autoProcessScan = useCallback(async (scannedBarcode) => {
  if (!scannedBarcode || processingScanRef.current) return;
  processingScanRef.current = true;

  setProcessingScan(true);
  setScanError("");
  setScanMessage("");

  try {
    const res = await barOrdersAPI.processScan({
      ORDERNUMBER: orderData?.ORDERNUMBER,
      BARCODE: scannedBarcode,
      QUANTITY: qty || 1,
      KITCHEN: department,
    });

    const scanData = res.data?.data || {};

    // SUCCESS path
    if (res.data?.success === true) {
      // Refetch scanned items
      const scannedRes = await barOrdersAPI.getScannedItems(orderData.ORDERNUMBER);
      const scannedData = scannedRes.data?.data || [];
      setScannedItems(scannedData);

      setScanMessage(`✓ ${scanData.itemName || 'Item'} scanned successfully.`);
      setItemCode(scanData.itemCode || "");
      setItemName(scanData.itemName || "");
      setPrice(scanData.calculatedPrice || "");

      // Cocktail modal
      if (scanData.isCocktailIngredient && Array.isArray(scanData.addedThisScan) && scanData.addedThisScan.length > 0) {
        setScannedCocktailData({
          name: scanData.itemName || "Cocktail",
          ingredients: scanData.addedThisScan.map(ing => ({
            item_code: ing.itemCode,
            item_name: ing.itemName,
            pegs: ing.pegs || 1,
            quantity: ing.scanQuantity,
          })),
        });
        setShowCocktailModal(true);
      }

      setTimeout(() => {
        if (isMountedRef.current) {
          setBarcode("");
          setQty("");
        }
      }, 800);
    } 
    // Backend returned error (400, etc.)
    else {
      setScanError(scanData.message || res.data?.message || "Scan failed");
    }

  } catch (error) {
    const errMsg = error.response?.data?.message || error.message || "Failed to process scan.";
    setScanError(errMsg);
    console.error("Process Scan Error:", error);
  } finally {
    setProcessingScan(false);
    processingScanRef.current = false;
    setTimeout(() => {
      if (isMountedRef.current) {
        setScanMessage("");
        setScanError("");
      }
    }, 4000);
  }
}, [orderData, department, qty]);

  const startScanner = async () => {
    try {
      setCameraError("");
      setScanError("");
      setScanMessage("");
      setScanSuccess(false);
      hasScannedRef.current = false;
      isStoppingRef.current = false;
      setScanning(true);
    } catch (error) {
      console.error("Error opening scanner:", error);
    }
  };

  const stopScanner = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === 2) await scanner.stop();
        } catch (err) { }
        try {
          await scanner.clear();
        } catch (err) { }
      }

      const video = document.querySelector("#qr-reader video");
      if (video && video.srcObject) {
        const stream = video.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }

      const qrReader = document.getElementById("qr-reader");
      if (qrReader) qrReader.innerHTML = "";

      scannerRef.current = null;
      setScanning(false);
      setScanSuccess(false);
      hasScannedRef.current = false;
    } catch (error) {
      console.error("Error stopping scanner:", error);
    } finally {
      isStoppingRef.current = false;
    }
  };

  useEffect(() => {
    if (!scanning) return;

    let scannerInstance;

    const initScanner = async () => {
      try {
        scannerInstance = new Html5Qrcode("qr-reader");
        scannerRef.current = scannerInstance;

        await scannerInstance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 340, height: 200 }, aspectRatio: 1.7778 },
          async (decodedText) => {
            if (hasScannedRef.current || processingScan) return;
            hasScannedRef.current = true;

            setScanSuccess(true);
            setBarcode(decodedText);
            isManualScanRef.current = false;
            await autoProcessScan(decodedText);

            setTimeout(() => {
              if (scannerRef.current) stopScanner();
            }, 500);
          }
        );
      } catch (err) {
        console.error("Scanner start failed:", err);
        setCameraError("Camera permission issue.");
        setScanning(false);
      }
    };

    initScanner();
  }, [scanning, autoProcessScan, processingScan]);

 const handleItemClick = async (item) => {
  if (!item.LINK_ENABLED || item.LINK_ENABLED !== "Y") return;
  try {
    // Pass both item ID and order number
    const res = await barOrdersAPI.getCocktailDetailsById(item.ITEM_ID, orderData?.ORDERNUMBER);
    const cocktail = res.data?.data;
    const ingredients = Array.isArray(cocktail?.details)
      ? cocktail.details.map((detail) => ({
          item_code: detail.ITEM_CODE,
          item_name: detail.ITEM_NAME,
          pegs: detail.PEGS,
          quantity: detail.QUANTITY || 1,
        }))
      : [];

    if (!ingredients.length) {
      alert("No recipe details found for this item.");
      return;
    }
    setScannedCocktailData({
      name: cocktail?.ITEM_NAME || item.ITEM_NAME,
      ingredients,
    });
    setShowCocktailModal(true);
  } catch (error) {
    console.error("Error fetching cocktail details:", error);
    alert("Failed to load cocktail details.");
  }
};

  const handleCancelItem = async (item) => {
    if (item.CAN_CANCEL !== "Y") {
      alert("This item cannot be cancelled.");
      return;
    }

    try {
      await barOrdersAPI.cancelItem({ ORDER_LINE_ID: item.ORDER_LINE_ID });
      alert("Item cancelled successfully.");
      fetchOrderItems();
    } catch (error) {
      console.error("Error cancelling item:", error);
      alert("Failed to cancel item. Please try again.");
    }
  };

  // Complete order
  const handleCompleteOrder = async () => {
    const totalOrderedQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalScannedQty = scannedItems.reduce((sum, item) => sum + item.scanQuantity, 0);

    if (totalScannedQty < totalOrderedQty) {
      alert(`Cannot complete order. Only ${totalScannedQty} of ${totalOrderedQty} items scanned.`);
      return;
    }

    if (window.confirm(`Are you sure you want to complete Order #${orderData.ORDERNUMBER}?`)) {
      try {
        setCompleting(true);
        await barOrdersAPI.updateStatus({
          ORDERNUMBER: orderData.ORDERNUMBER,
          KITCHEN: department,
          STATUS: "Completed",
        });
        alert("Order completed successfully!");
        navigate(-1);
      } catch (error) {
        console.error("Error completing order:", error);
        alert("Failed to complete order. Please try again.");
      } finally {
        setCompleting(false);
      }
    }
  };

  // Cancel entire order
  const handleCancelOrder = async () => {
    if (window.confirm(`Are you sure you want to cancel Order #${orderData.ORDERNUMBER}? This action cannot be undone.`)) {
      try {
        setCancelling(true);
        for (const item of items) {
          if (item.CAN_CANCEL === "Y") {
            await barOrdersAPI.cancelItem({ ORDER_LINE_ID: item.ORDER_LINE_ID });
          }
        }
        alert("Order cancelled successfully!");
        navigate(-1);
      } catch (error) {
        console.error("Error cancelling order:", error);
        alert("Failed to cancel order. Please try again.");
      } finally {
        setCancelling(false);
      }
    }
  };

  // Clear all scanned items from session
  const handleClearScannedItems = async () => {
    if (window.confirm("Are you sure you want to clear all scanned items history?")) {
      try {
        await barOrdersAPI.clearScannedItems(orderData.ORDERNUMBER);
        setScannedItems([]);
        alert("Scanned items cleared successfully!");
      } catch (error) {
        console.error("Error clearing scanned items:", error);
        alert("Failed to clear scanned items. Please try again.");
      }
    }
  };

  const totalOrderedQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalScannedQty = scannedItems.reduce((sum, item) => sum + item.scanQuantity, 0);
  const isComplete = totalScannedQty >= totalOrderedQty && totalOrderedQty > 0;

  if (!orderData) {
    return (
      <div className="p-6">
        <p className="text-red-500 font-medium">No order selected.</p>
        <button onClick={() => navigate(`/${department.toLowerCase()}/dashboard`)} className="mt-4 px-4 py-2 bg-afmc-maroon hover:bg-afmc-maroon2 transition text-white rounded-xl">
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
      {/* Back Button */}
      <div className="flex justify-between items-center">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 transition">
          <div className="flex items-center gap-1">
            <FaArrowLeft className="text-xl" />
            <p className="text-sm font-medium">Back to Orders</p>
          </div>
        </button>
      </div>

      {/* Header Card with Order Summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Order Number</label>
            <div className="text-lg font-semibold text-gray-900">{orderData.ORDERNUMBER}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Name</label>
            <div className="text-gray-800">{orderedBy || orderData.FIRST_NAME || "Naveen Member"}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</label>
            <div className="text-gray-800">
              {totalOrderedQty} {totalScannedQty > 0 && `(Scanned: ${totalScannedQty})`}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
            <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${isComplete ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {isComplete ? "Ready to Complete" : `${totalOrderedQty - totalScannedQty} item(s) remaining`}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-800">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordered</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scanned</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cancel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No pending items found.</td></tr>
                  ) : (
                    items.map((item, idx) => {
                      const scannedQty = getScannedQuantityByItemCode(item.ITEM_ID);
                      const remainingQty = item.quantity - scannedQty;
                      return (
                        <tr key={item.ORDER_LINE_ID || idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-800">
                            {item.LINK_ENABLED === "Y" ? (
                              <button onClick={() => handleItemClick(item)} className="text-pink-600 hover:underline">
                                {item.ITEM_NAME}
                              </button>
                            ) : (item.ITEM_NAME)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">{item.quantity}</td>
                          <td className="px-6 py-4 text-sm text-green-600 font-medium">{scannedQty}</td>
                          <td className="px-6 py-4 text-sm text-orange-600 font-medium">{remainingQty}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.TYPE || "NA"}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleCancelItem(item)}
                              disabled={item.CAN_CANCEL !== "Y"}
                              className={`text-lg ${item.CAN_CANCEL === "Y" ? "text-red-400 hover:text-red-600" : "text-gray-300 cursor-not-allowed"}`}
                            >
                              <FaTimesCircle />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Barcode Scanner Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-800">Scan Barcode</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Barcode</label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      onKeyPress={handleBarcodeKeyPress}
                      onBlur={handleBarcodeBlur}
                      placeholder="Scan or enter barcode"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-1 focus:ring-pink-500"
                      disabled={processingScan}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="1"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
                      disabled={processingScan}
                    />
                  </div>
                  <button
                    onClick={scanning ? stopScanner : startScanner}
                    disabled={processingScan}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-afmc-maroon hover:bg-afmc-maroon2 transition text-white font-medium disabled:opacity-50"
                  >
                    <FaCamera /> {scanning ? "Stop Camera" : "Start Camera"}
                  </button>
                  {cameraError && <div className="text-sm text-red-600">{cameraError}</div>}
                  {processingScan && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <FaSpinner className="animate-spin" /> Processing scan...
                    </div>
                  )}
                  {scanMessage && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                      <FaCheckCircle /> {scanMessage}
                    </div>
                  )}
                  {scanError && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{scanError}</div>
                  )}
                </div>
                <div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 h-full">
                    <div className="relative" style={{ height: "300px" }}>
                      <div id="qr-reader" className="w-full h-full rounded-lg overflow-hidden" />
                      {!scanSuccess && scanning && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm rounded-lg">
                          Position barcode in frame
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Complete/Cancel Buttons and Scanned Items History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex gap-3">
              <button
                onClick={handleCompleteOrder}
                disabled={completing || !isComplete}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition shadow-sm ${isComplete && !completing ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
              >
                {completing ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                Complete Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition shadow-sm"
              >
                {cancelling ? <FaSpinner className="animate-spin" /> : <FaBan />}
                Cancel Order
              </button>
            </div>

            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <FaHistory className="text-gray-400" />
                <h2 className="text-base font-semibold text-gray-800">Scanned Items History</h2>
                <span className="text-xs text-gray-500">({scannedItems.length} items scanned)</span>
              </div>
              {scannedItems.length > 0 && (
                <button
                  onClick={handleClearScannedItems}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition"
                >
                  <FaTrash className="text-xs" />
                  Clear All
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scannedItems.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No items scanned yet.</td></tr>
                  ) : (
                    scannedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.itemCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{item.itemName}</td>
                        <td className="px-4 py-3 text-sm text-center font-medium">{item.scanQuantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(item.scannedAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">Rs {item.itemPrice || "0"}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500">{item.barcode}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Scanned Item Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-800">Current Scanned Item</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Item Code</p>
                <p className="mt-1 font-mono text-lg font-semibold text-gray-800">{itemCode || "-"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Item Name</p>
                <p className="mt-1 font-medium text-gray-800">{itemName || "-"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Price</p>
                <p className="mt-1 font-semibold text-gray-800">{price ? `Rs ${price}` : "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cocktail Recipe Modal */}
      {showCocktailModal && scannedCocktailData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{scannedCocktailData.name}</h2>
              <button onClick={() => setShowCocktailModal(false)} className="text-2xl">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Item Code</th>
                    <th className="px-4 py-2 text-left">Item Name</th>
                    <th className="px-4 py-2 text-center">Pegs</th>
                    <th className="px-4 py-2 text-center">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {scannedCocktailData.ingredients?.map((ing, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{ing.item_code}</td>
                      <td className="px-4 py-2">{ing.item_name}</td>
                      <td className="px-4 py-2 text-center">{ing.pegs || 0}</td>
                      <td className="px-4 py-2 text-center">{ing.quantity || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowCocktailModal(false)} className="flex-1 px-4 py-2 bg-afmc-maroon hover:bg-afmc-maroon2 transition text-white rounded-lg">
                  Confirm Scan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
