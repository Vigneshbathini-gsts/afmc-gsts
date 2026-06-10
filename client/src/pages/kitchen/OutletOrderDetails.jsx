import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  FaArrowLeft,
  FaSpinner,
  FaTimesCircle,
  FaCheckCircle,
  FaHistory,
  FaCheck,
  FaBan,
  FaTrash,
} from "react-icons/fa";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { barOrdersAPI } from "../../services/api";
import { Html5Qrcode } from "html5-qrcode";
import { toInitCap } from "../../utils/textFormat";
import { formatDisplayDate } from "../../utils/dateUtils";

export default function OutletOrderDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const orderDataFromState = location.state;
  const orderNumberFromQuery = searchParams.get("orderNumber") || "";
  const kitchenTypeFromQuery = searchParams.get("kitchenType") || "";

  const [orderData, setOrderData] = useState(() => {
    if (orderDataFromState) return orderDataFromState;

    try {
      const raw = sessionStorage.getItem("outletOrderDetails:lastOrder");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
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
  const [qty, setQty] = useState("1");
  const [scanMessage, setScanMessage] = useState("");
  const [scanError, setScanError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [processingScan, setProcessingScan] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [scannedCocktailData, setScannedCocktailData] = useState(null);
  const [showCocktailModal, setShowCocktailModal] = useState(false);
  const [activeRecipeParentItem, setActiveRecipeParentItem] = useState("");

  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isMountedRef = useRef(true);
  const isManualScanRef = useRef(false);
  const processingScanRef = useRef(false);
  const autoStartedScannerRef = useRef(false);

  const getScanLinePrice = (item) => {
    const explicitTotal = Number(item?.lineTotalPrice);
    if (Number.isFinite(explicitTotal)) return explicitTotal.toFixed(2);

    const unitPrice = Number(item?.itemPrice || 0);
    const scanQuantity = Number(item?.scanQuantity || 0);
    return (unitPrice * scanQuantity).toFixed(2);
  };


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
    // Persist/restore order data so refresh doesn't lose the context.
    // Priority: navigation state -> sessionStorage -> query params.
    const nextFromState = orderDataFromState || null;
    if (nextFromState && nextFromState !== orderData) {
      setOrderData(nextFromState);
      try {
        sessionStorage.setItem("outletOrderDetails:lastOrder", JSON.stringify(nextFromState));
      } catch {
        // ignore
      }
    }
    // If we don't have full order data but we do have an order number, at least restore that,
    // so we can fetch items + scanned history from the backend.
    if (!orderData?.ORDERNUMBER && orderNumberFromQuery) {
      const minimal = {
        ORDERNUMBER: orderNumberFromQuery,
        kitchenType: kitchenTypeFromQuery || undefined,
      };
      setOrderData(minimal);
      try {
        sessionStorage.setItem("outletOrderDetails:lastOrder", JSON.stringify(minimal));
      } catch {
        // ignore
      }
    }

    if ((orderDataFromState?.ORDERNUMBER || orderData?.ORDERNUMBER || orderNumberFromQuery) && fetchOrderItems) {
      fetchOrderItems();
    }
    return () => {
      isMountedRef.current = false;
      if (scannerRef.current) stopScanner();
    };
  }, [
    orderDataFromState,
    orderData,
    orderNumberFromQuery,
    kitchenTypeFromQuery,
    fetchOrderItems,
  ]);


  const getScannedQuantityByItemCode = useCallback((item) => {
    const orderLineId = Number(item.ORDER_LINE_ID ?? item.orderLineId ?? 0);

    if (orderLineId > 0) {
      return scannedItems
        .filter(si => Number(si.orderLineId ?? 0) === orderLineId)
        .reduce((sum, si) => sum + Number(si.scanQuantity || 0), 0);
    }
    const normalizedItemCode = String(item.ITEM_ID ?? item.item_code ?? item.itemCode ?? "").trim();
    const unitFactor = Number(item.ingredientsPerUnit || 1);
    const rawIngredientScans = scannedItems
      .filter(si => String(si.parentItem ?? si.itemCode ?? "").trim() === normalizedItemCode)
      .reduce((sum, si) => sum + Number(si.scanQuantity || 0), 0);
    // Only return completed "whole" parent units
    return Math.floor(rawIngredientScans / unitFactor);
  }, [scannedItems]);

  // const handleBarcodeKeyPress = async (e) => {
  //   if (e.key === "Enter" && barcode && barcode.trim() !== "" && !processingScanRef.current && !scanning) {
  //     e.preventDefault();
  //     await confirmScan();
  //   }
  // };

  const handleBarcodeKeyPress = async (e) => {
  if (
    e.key === "Enter" &&
    e.target.value.trim() &&
    !processingScanRef.current
  ) {
    e.preventDefault();
    await autoProcessScan(e.target.value.trim());
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
    const scanQuantity = Number(qty);
    if (!Number.isInteger(scanQuantity) || scanQuantity <= 0) {
      setScanError("Enter a valid quantity before confirming the scan.");
      return;
    }

    processingScanRef.current = true;

    setProcessingScan(true);
    setScanError("");
    setScanMessage("");

    try {
      const res = await barOrdersAPI.processScan({
        ORDERNUMBER: orderData?.ORDERNUMBER,
        BARCODE: scannedBarcode,
        QUANTITY: scanQuantity,
        KITCHEN: department,
        PARENT_ITEM: activeRecipeParentItem || "",
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

        setTimeout(() => {
          if (isMountedRef.current) {
            setBarcode("");
            setQty("1");
          }
        }, 800);
      }
      // Backend returned error (400, etc.)
      else {
        const message = scanData.message || res.data?.message || "Scan failed";
        setScanError(message);
        if (
          typeof message === "string" &&
          (message.toLowerCase().includes("morethan order quantity") ||
            message.toLowerCase().includes("duplicate bottle scan") ||
            message.toLowerCase().includes("morethen stock"))
        ) {
          window.alert(message);
        }
      }

    } catch (error) {
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to process scan.";
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
  }, [orderData, department, qty, activeRecipeParentItem]);

  const confirmScan = useCallback(async () => {
    const trimmedBarcode = String(barcode || "").trim();
    if (!trimmedBarcode) {
      setScanError("Scan or enter a barcode before confirming.");
      return;
    }
    await autoProcessScan(trimmedBarcode);
  }, [barcode, autoProcessScan]);

  const startScanner = useCallback(async () => {
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
  }, []);

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
          {
            fps: 10,
            aspectRatio: 16 / 9,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const width = Math.floor(minEdge * 0.9);
              const height = Math.floor(width * 0.55);
              return { width, height };
            },
          },
          async (decodedText) => {
            if (hasScannedRef.current || processingScanRef.current) return;
            hasScannedRef.current = true;

            const scannedBarcode = String(decodedText || "").trim();
            setScanSuccess(true);
            setBarcode(scannedBarcode);
            isManualScanRef.current = false;
            setScanMessage("Barcode captured. Processing scan...");

            setTimeout(async () => {
              if (scannerRef.current) await stopScanner();
              await autoProcessScan(scannedBarcode);
              if (isMountedRef.current) {
                hasScannedRef.current = false;
                startScanner();
              }
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
  }, [autoProcessScan, scanning, startScanner]);

  useEffect(() => {
    if (!orderData?.ORDERNUMBER || loading || scanning || autoStartedScannerRef.current) return;

    autoStartedScannerRef.current = true;
    startScanner();
  }, [loading, orderData?.ORDERNUMBER, scanning, startScanner]);

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
      setActiveRecipeParentItem(String(item.ITEM_ID || "").trim());
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
    const totalRequiredScans = items.reduce(
      (sum, item) => sum + (Number(item.quantity || 0) * Number(item.ingredientsPerUnit || 1)),
      0
    );

    const totalScannedQty = scannedItems.reduce(
      (sum, item) => sum + Number(item.scanQuantity || 0),
      0
    );

    if (totalScannedQty < totalRequiredScans) {
      alert(
        `Cannot complete order. Only ${totalScannedQty} of ${totalRequiredScans} required scans completed.`
      );
      return;
    }

    if (
      window.confirm(
        `Are you sure you want to complete Order #${orderData.ORDERNUMBER}?`
      )
    ) {
      try {
        setCompleting(true);
        await barOrdersAPI.updateStatus({
          ORDERNUMBER: orderData.ORDERNUMBER,
          KITCHEN: department,
          STATUS: "Completed",
        });

        // 1st API
        await barOrdersAPI.completeOrder({
          ORDERNUMBER: orderData.ORDERNUMBER,
          KITCHEN: department,
          STATUS: "Completed",
        });



        alert("Order completed successfully!");
        navigate(-1);

      } catch (error) {
        console.error("Error completing order:", error);

        alert(
          error?.response?.data?.message ||
          "Failed to complete order. Please try again."
        );
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
        await barOrdersAPI.cancelOrder({
          ORDERNUMBER: orderData.ORDERNUMBER,
          KITCHEN: department,
        });
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

  const totalRequiredScans = items.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.ingredientsPerUnit || 1)),
    0
  );
  const totalScannedQty = scannedItems.reduce((sum, item) => sum + Number(item.scanQuantity || 0), 0);
  const isComplete = totalScannedQty >= totalRequiredScans && totalRequiredScans > 0;
  // console.log("Render:", { totalOrderedQty, totalScannedQty, isComplete });
  const totalOrderedUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

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
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 p-4 md:p-6 space-y-6">
        <style>{`
          #qr-reader video, #qr-reader canvas {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover;
          }
        `}</style>
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Order Details
          </h1>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-afmc-gold/30 text-gray-700 hover:text-afmc-maroon hover:bg-afmc-maroon/5 transition whitespace-nowrap"
          >
            <FaArrowLeft />
            Back to Orders
          </button>
        </div>

        {/* Header Card with Order Summary */}
        <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500   tracking-wider">Order Number</label>
              <div className="text-lg font-semibold text-gray-900">{orderData.ORDERNUMBER}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500   tracking-wider">Name</label>
              <div className="text-gray-800">{orderedBy || orderData.FIRST_NAME || "Naveen Member"}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500   tracking-wider">Quantity</label>
              <div className="text-gray-800">
                {totalOrderedUnits} unit(s) {totalScannedQty > 0 && `(Scans: ${totalScannedQty}/${totalRequiredScans})`}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500   tracking-wider">Status</label>
              <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${isComplete ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                {isComplete ? "Ready to Complete" : `${totalRequiredScans - totalScannedQty} scan(s) remaining`}
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items Table */}
            <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-base font-semibold text-gray-800">Order Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500  ">Item Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500  ">Ordered (Paid + Free)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500  ">Scanned</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500  ">Remaining</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500  ">Type</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500  ">Cancel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No pending items found.</td></tr>
                    ) : (
                      items.map((item, idx) => {
                        const scannedQty = getScannedQuantityByItemCode(item);
                        const remainingQty = item.quantity - scannedQty;
                        return (
                          <tr key={item.ORDER_LINE_ID || idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-800">
                              {item.LINK_ENABLED === "Y" ? (
                                <button onClick={() => handleItemClick(item)} className="text-pink-600 hover:underline">
                                  {toInitCap(item.ITEM_NAME || "")}
                                </button>
                              ) : (
                                toInitCap(item.ITEM_NAME || "")
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium">
                              {item.quantity}
                              {item.freeQty > 0 && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ({item.paidQty}P + {item.freeQty}F)
                                </span>
                              )}
                            </td>
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
            <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm overflow-hidden">
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
                        onKeyDown={handleBarcodeKeyPress}
                        placeholder="Scan or enter barcode"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-1 focus:ring-pink-500"
                        disabled={processingScan}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        placeholder="1"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm"
                        disabled={processingScan}
                      />
                    </div>
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
                    <div className="rounded-lg border border-gray-200 bg-black p-0 overflow-hidden">
                      <div className="relative w-full aspect-video min-h-[240px]">
                        <div id="qr-reader" className="absolute inset-0 w-full h-full" />
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500  ">Item Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500  ">Item Name</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500  ">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500  ">Time</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500  ">Price</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500  ">Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scannedItems.length === 0 ? (
                      <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No items scanned yet.</td></tr>
                    ) : (
                      scannedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.itemCode}</td>
                          <td className="px-4 py-3 text-sm text-gray-800">{toInitCap(item.itemName || "")}</td>
                          <td className="px-4 py-3 text-sm text-center font-medium">{item.scanQuantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDisplayDate(item.scannedAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">Rs {getScanLinePrice(item)}</td>
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
            <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-base font-semibold text-gray-800">Current Scanned Item</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400   tracking-wider">Item Code</p>
                  <p className="mt-1 font-mono text-lg font-semibold text-gray-800">{itemCode || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400   tracking-wider">Item Name</p>
                  <p className="mt-1 font-medium text-gray-800">{itemName ? toInitCap(itemName) : "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-400   tracking-wider">Price</p>
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
                        <td className="px-4 py-2">{toInitCap(ing.item_name || "")}</td>
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
    </div>
  );
}
