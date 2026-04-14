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
import { barOrdersAPI } from "../../services/api";
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
  const [scannedItems, setScannedItems] = useState([]);
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

  // Fetch order items
  const fetchOrderItems = useCallback(async () => {
    if (!orderData?.ORDERNUMBER) return;

    try {
      setLoading(true);
      const res = await barOrdersAPI.getOrderItems({
        ORDERNUMBER: orderData.ORDERNUMBER,
        KITCHEN: department,
      });
      const itemsData = res.data?.data || res.data || [];
      if (isMountedRef.current) {
        setItems(itemsData);
      }
    } catch (error) {
      console.error("Error fetching order items:", error);
      if (isMountedRef.current) setItems([]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [orderData?.ORDERNUMBER, department]);

  useEffect(() => {
    isMountedRef.current = true;
    if (orderData?.ORDERNUMBER) {
      fetchOrderItems();
      setScannedItems([]);
    }

    return () => {
      isMountedRef.current = false;
      if (scannerRef.current) stopScanner();
      setScannedItems([]);
    };
  }, [orderData?.ORDERNUMBER, fetchOrderItems]);

  // Helper function to get scanned count for an item (number of barcodes scanned)
  const getScannedCountByItemCode = useCallback((itemCode) => {
    return scannedItems.filter(item => item.itemCode === itemCode).length;
  }, [scannedItems]);

  // Helper function to check if barcode already scanned
  const isBarcodeScanned = useCallback((barcode) => {
    return scannedItems.some(item => item.barcode === barcode);
  }, [scannedItems]);

  const handleBarcodeBlur = async () => {
    if (barcode && barcode.trim() !== "" && !processingScan && !scanning && isManualScanRef.current) {
      await autoProcessScan(barcode);
    }
    isManualScanRef.current = false;
  };

  const handleBarcodeKeyPress = async (e) => {
    if (e.key === "Enter" && barcode && barcode.trim() !== "" && !processingScan && !scanning) {
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
    if (!scannedBarcode || processingScan) return;

    setProcessingScan(true);
    setScanError("");
    setScanMessage("");

    // Check for duplicate scan in current session (same barcode)
    if (isBarcodeScanned(scannedBarcode)) {
      setScanError(`Duplicate scan! Barcode ${scannedBarcode} has already been scanned.`);
      setProcessingScan(false);
      setTimeout(() => setScanError(""), 3000);
      return;
    }

    try {
      const res = await barOrdersAPI.processScan({
        ORDERNUMBER: orderData?.ORDERNUMBER,
        BARCODE: scannedBarcode,
        QUANTITY: qty || 1,
        KITCHEN: department,
      });

      const scanData = res.data?.data || res.data || {};
      
      // Get count of unique barcodes scanned for this item
      const uniqueBarcodesCount = scannedItems.filter(
        item => item.itemCode === scanData.itemCode
      ).length;
      
      // Each barcode scan represents 1 physical bottle/item
      // Check if adding this scan would exceed ordered quantity
      if (uniqueBarcodesCount + 1 > scanData.orderedQuantity) {
        setScanError(`Cannot scan more items for "${scanData.itemName}". Only ${scanData.orderedQuantity} item(s) ordered.`);
        setProcessingScan(false);
        setTimeout(() => setScanError(""), 3000);
        return;
      }

      // Check stock availability from backend response
      if (scanData.stockQuantity <= 0) {
        setScanError(`No stock available for "${scanData.itemName}".`);
        setProcessingScan(false);
        setTimeout(() => setScanError(""), 3000);
        return;
      }

      // Add scanned item to state (each barcode = 1 unit)
      const newScannedItem = {
        id: Date.now(),
        itemCode: scanData.itemCode,
        itemName: scanData.itemName,
        scanQuantity: 1,
        itemPrice: scanData.calculatedPrice,
        barcode: scannedBarcode,
        scannedAt: new Date().toISOString(),
        isFreeItem: scanData.isFreeItem || false
      };
      
      setScannedItems(prev => [...prev, newScannedItem]);

      setScanMessage(`✓ ${scanData.itemName} scanned for order ${orderData?.ORDERNUMBER}.`);
      setItemCode(scanData.itemCode || "");
      setItemName(scanData.itemName || "");
      setPrice(scanData.calculatedPrice || "");

      // Show cocktail modal if needed
      if (
        scanData.isCocktailIngredient &&
        Array.isArray(scanData.ingredients) &&
        scanData.ingredients.length
      ) {
        setScannedCocktailData({
          name: scanData.itemName || scanData.parentItem || "Cocktail",
          ingredients: scanData.ingredients.map((ingredient) => ({
            item_code: ingredient.item_code,
            item_name: ingredient.item_name,
            pegs: ingredient.total_quantity,
            quantity: ingredient.total_quantity,
          })),
        });
        setShowCocktailModal(true);
      }

      setTimeout(() => {
        if (isMountedRef.current) {
          setBarcode("");
          setQty("");
        }
        setProcessingScan(false);
        setTimeout(() => {
          if (isMountedRef.current) setScanMessage("");
        }, 3000);
      }, 1500);

    } catch (error) {
      setScanMessage("");
      setScanError(error.response?.data?.message || error.message || "Failed to process scan.");
      console.error("Process Scan Error:", error);
      setProcessingScan(false);
      setTimeout(() => {
        if (isMountedRef.current) setScanError("");
      }, 3000);
    }
  }, [orderData, department, qty, processingScan, scannedItems, isBarcodeScanned]);

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
      // Remove any scanned items for this cancelled item
      setScannedItems(prev => prev.filter(scanned => scanned.itemCode !== item.ITEM_ID));
    } catch (error) {
      console.error("Error cancelling item:", error);
      alert("Failed to cancel item. Please try again.");
    }
  };

  // Complete order
  const handleCompleteOrder = async () => {
    // Check if all ordered items have been scanned
    let canComplete = true;
    let missingItems = [];
    
    for (const orderedItem of items) {
      const scannedCount = getScannedCountByItemCode(orderedItem.ITEM_ID);
      if (scannedCount < orderedItem.quantity) {
        canComplete = false;
        missingItems.push(`${orderedItem.ITEM_NAME} (${scannedCount}/${orderedItem.quantity})`);
      }
    }

    if (!canComplete) {
      alert(`Cannot complete order. Missing scans for:\n${missingItems.join('\n')}`);
      return;
    }

    if (window.confirm(`Are you sure you want to complete Order ${orderData.ORDERNUMBER}?`)) {
      try {
        setCompleting(true);
        await barOrdersAPI.updateStatus({
          ORDERNUMBER: orderData.ORDERNUMBER,
          KITCHEN: department,
          STATUS: "Completed",
        });
        alert("Order completed successfully!");
        setScannedItems([]);
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
    if (window.confirm(`Are you sure you want to cancel Order ${orderData.ORDERNUMBER}? This action cannot be undone.`)) {
      try {
        setCancelling(true);
        for (const item of items) {
          if (item.CAN_CANCEL === "Y") {
            await barOrdersAPI.cancelItem({ ORDER_LINE_ID: item.ORDER_LINE_ID });
          }
        }
        alert("Order cancelled successfully!");
        setScannedItems([]);
        navigate(-1);
      } catch (error) {
        console.error("Error cancelling order:", error);
        alert("Failed to cancel order. Please try again.");
      } finally {
        setCancelling(false);
      }
    }
  };

  // Clear all scanned items
  const handleClearScannedItems = () => {
    if (window.confirm("Are you sure you want to clear all scanned items history?")) {
      setScannedItems([]);
      alert("Scanned items cleared successfully!");
    }
  };

  const totalOrderedQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalScannedCount = scannedItems.length;
  const isComplete = totalScannedCount >= totalOrderedQty && totalOrderedQty > 0;

  if (!orderData) {
    return (
      <div className="p-6">
        <p className="text-red-500 font-medium">No order selected.</p>
        <button onClick={() => navigate(`/${department.toLowerCase()}/dashboard`)} className="mt-4 px-4 py-2 bg-pink-600 text-white rounded-xl">
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
              {totalOrderedQty} {totalScannedCount > 0 && `(Scanned: ${totalScannedCount})`}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
            <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${isComplete ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {isComplete ? "Ready to Complete" : `${totalOrderedQty - totalScannedCount} item(s) remaining`}
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
                      const scannedCount = getScannedCountByItemCode(item.ITEM_ID);
                      const remainingQty = item.quantity - scannedCount;
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
                          <td className="px-6 py-4 text-sm text-green-600 font-medium">{scannedCount}</td>
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
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity (Optional)</label>
                    <input
                      type="number"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      placeholder="1"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
                      disabled={processingScan}
                    />
                    <p className="text-xs text-gray-400 mt-1">Note: Each barcode scan counts as 1 item regardless of quantity</p>
                  </div>
                  <button
                    onClick={scanning ? stopScanner : startScanner}
                    disabled={processingScan}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 text-white font-medium hover:bg-pink-700 disabled:opacity-50"
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
                <span className="text-xs text-gray-500">({scannedItems.length} scans)</span>
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
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Scan </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scannedItems.length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No items scanned yet.</td></tr>
                  ) : (
                    scannedItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {item.itemName}
                          {item.isFreeItem && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Free</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-medium text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(item.scannedAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {item.itemPrice ? `Rs ${item.itemPrice}` : "Rs 0"}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-500">{item.barcode}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Current Scanned Item Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
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
              <h3 className="text-sm font-medium text-gray-500 mb-3">Recipe Details</h3>
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
                    <tr key={idx} className="border-b">
                      <td className="px-4 py-2 font-mono text-xs">{ing.item_code}</td>
                      <td className="px-4 py-2">{ing.item_name}</td>
                      <td className="px-4 py-2 text-center">{ing.pegs || 0}</td>
                      <td className="px-4 py-2 text-center">{ing.quantity || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setShowCocktailModal(false)} 
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition"
                >
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
