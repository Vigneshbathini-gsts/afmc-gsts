import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBarcode,
  FaBoxOpen,
  FaRupeeSign,
  FaArrowLeft,
  FaSave,
  FaCamera,
  FaTimes,
  FaCheckCircle,
} from "react-icons/fa";
import { Html5Qrcode } from "html5-qrcode";
import { priceAPI } from "../../services/api";

export default function PriceUpdate() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);
  const isStoppingRef = useRef(false);

  const [formData, setFormData] = useState({
    barcode: "",
    itemCode: "",
    itemName: "",
    unitPrice: "",
  });

  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingItem, setFetchingItem] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);

  // =========================
  // Input Change
  // =========================
  const handleChange = (e) => {
  const { name, value } = e.target;

  // 🔥 If barcode is cleared → reset everything
  if (name === "barcode" && value.trim() === "") {
    setFormData({
      barcode: "",
      itemCode: "",
      itemName: "",
      unitPrice: "",
    });

    setError("");
    setMessage("");
    return;
  }

  setFormData((prev) => ({
    ...prev,
    [name]: value,
  }));

  setError("");
  setMessage("");
};

  // =========================
  // Fetch Item By Barcode
  // =========================
  const fetchItemByBarcode = async (barcode) => {
    try {
      if (!barcode) return;

      setFetchingItem(true);
      setError("");
      setMessage("");

      const res = await priceAPI.getItemByBarcode(barcode);
      const item = res.data.item;

      setFormData((prev) => ({
        ...prev,
        barcode: item.barcode || barcode,
        itemCode: item.itemCode || "",
        itemName: item.itemName || "",
        unitPrice: item.unitPrice || "",
      }));
    } catch (err) {
      setFormData((prev) => ({
        ...prev,
        itemCode: "",
        itemName: "",
        unitPrice: "",
      }));

      setError(err.response?.data?.message || "Item not found");
    } finally {
      setFetchingItem(false);
    }
  };

  // =========================
  // Barcode Enter Search
  // =========================
  const handleBarcodeBlur = () => {
    if (formData.barcode.trim()) {
      fetchItemByBarcode(formData.barcode.trim());
    }
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === "Enter") {
      fetchItemByBarcode(formData.barcode.trim());
    }
  };

  // =========================
  // Save Updated Price
  // =========================
  const handleSave = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      if (!formData.barcode.trim()) {
        setError("Barcode is required");
        return;
      }

      if (!formData.itemName.trim()) {
        setError("Please fetch a valid item first");
        return;
      }

      if (!formData.unitPrice || Number(formData.unitPrice) <= 0) {
        setError("Please enter a valid unit price");
        return;
      }

      await priceAPI.updateItemPrice({
        barcode: formData.barcode,
        unitPrice: formData.unitPrice,
      });

      setMessage("Price updated successfully");

      setFormData({
        barcode: "",
        itemCode: "",
        itemName: "",
        unitPrice: "",
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update price");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // Navigation
  // =========================
  const handleBack = () => {
    navigate(-1);
  };

  // =========================
  // Start Scanner
  // =========================
  const startScanner = async () => {
    try {
      setError("");
      setMessage("");
      setScanSuccess(false);
      hasScannedRef.current = false;
      isStoppingRef.current = false;
      setShowScanner(true);
    } catch (error) {
      console.error("Error opening scanner:", error);
    }
  };

  // =========================
  // Fully Stop Scanner
  // =========================
  const stopScanner = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      const scanner = scannerRef.current;

      if (scanner) {
        try {
          await scanner.stop();
        } catch (stopErr) {
          console.warn("Scanner stop warning:", stopErr);
        }

        try {
          await scanner.clear();
        } catch (clearErr) {
          console.warn("Scanner clear warning:", clearErr);
        }
      }

      // Extra cleanup: force stop media tracks if browser still holds them
      const video = document.querySelector("#reader video");
      if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        video.srcObject = null;
      }

      scannerRef.current = null;
      setShowScanner(false);
      setScanSuccess(false);
      hasScannedRef.current = false;
    } catch (error) {
      console.error("Error stopping scanner:", error);
      setShowScanner(false);
    } finally {
      isStoppingRef.current = false;
    }
  };

  // =========================
  // Scanner Logic
  // =========================
  useEffect(() => {
    let scannerInstance;

    const initScanner = async () => {
      try {
        scannerInstance = new Html5Qrcode("reader");
        scannerRef.current = scannerInstance;

        await scannerInstance.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 340, height: 200 },
            aspectRatio: 1.7778,
          },
          async (decodedText) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;

            console.log("Scanned Barcode:", decodedText);
            setScanSuccess(true);

            setFormData((prev) => ({
              ...prev,
              barcode: decodedText,
            }));

            setTimeout(async () => {
              await stopScanner();
              await fetchItemByBarcode(decodedText);
            }, 700);
          },
          () => {
            // ignore scan errors
          }
        );
      } catch (err) {
        console.error("Scanner start failed:", err);
        setError("Unable to access camera. Please allow camera permission.");
        setShowScanner(false);
      }
    };

    if (showScanner) {
      initScanner();
    }

    return () => {
      // Important cleanup when component unmounts or modal closes
      if (scannerRef.current) {
        stopScanner();
      }
    };
  }, [showScanner]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative p-6 md:p-10 overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Price Update</h1>
         
        </div>

        {/* Form Card */}
        <div className="bg-white/70 backdrop-blur-md border border-white/40 shadow-xl rounded-3xl p-6 md:p-8 space-y-6">
          {/* Barcode */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Barcode
            </label>
            <div className="flex gap-3">
              <div className="flex items-center w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-afmc-maroon">
                <FaBarcode className="text-gray-400 mr-3" />
                <input
                  type="text"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  onBlur={handleBarcodeBlur}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="Enter or scan barcode"
                  className="w-full outline-none text-gray-700 bg-transparent"
                />
              </div>

              <button
                type="button"
                onClick={startScanner}
                className="px-5 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white shadow-md transition flex items-center gap-2"
              >
                <FaCamera />
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Item Name
            </label>
            <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm">
              <FaBoxOpen className="text-gray-400 mr-3" />
              <input
                type="text"
                name="itemName"
                value={formData.itemName}
                readOnly
                placeholder="Item name will auto-fill"
                className="w-full outline-none text-gray-700 bg-transparent"
              />
            </div>
          </div>

          {/* Unit Price */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Unit Price
            </label>
            <div className="flex items-center rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-afmc-maroon">
              <FaRupeeSign className="text-gray-400 mr-3" />
              <input
                type="number"
                name="unitPrice"
                value={formData.unitPrice}
                onChange={handleChange}
                placeholder="Enter updated price"
                className="w-full outline-none text-gray-700 bg-transparent"
              />
            </div>
          </div>

          {/* Status */}
          {/* {fetchingItem && (
            <div className="bg-blue-100 text-blue-700 text-sm px-4 py-3 rounded-2xl border border-blue-200">
              Fetching item details...
            </div>
          )} */}

          {message && (
            <div className="bg-green-100 text-green-700 text-sm px-4 py-3 rounded-2xl border border-green-200">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-100 text-red-700 text-sm px-4 py-3 rounded-2xl border border-red-200">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || fetchingItem}
              className="flex-1 bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold py-3 rounded-2xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <FaSave />
              {loading ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
            >
              <FaArrowLeft />
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 relative border border-white/30">
            {/* Close Button */}
            <button
              onClick={stopScanner}
              className="absolute top-4 right-4 text-gray-600 hover:text-red-500 text-xl transition"
            >
              <FaTimes />
            </button>

            {/* Header */}
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-gray-800">Scan Barcode</h2>
              <p className="text-sm text-gray-500 mt-1">
                Align the barcode within the scanning area
              </p>
            </div>

            {/* Scanner Frame */}
            <div className="relative rounded-3xl overflow-hidden border-4 border-afmc-maroon/20 shadow-lg bg-black">
              <div
                id="reader"
                className="w-full min-h-[320px] md:min-h-[380px]"
              ></div>

              {/* Scan Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-6 border-2 border-white/70 rounded-2xl"></div>

                {!scanSuccess && (
                  <div className="absolute left-6 right-6 top-10 h-1 bg-afmc-maroon2 rounded-full shadow-lg animate-pulse"></div>
                )}

                {scanSuccess && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <div className="bg-white/90 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
                      <FaCheckCircle className="text-green-600 text-2xl" />
                      <span className="text-lg font-semibold text-gray-800">
                        Barcode Detected
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Text */}
            <div className="mt-4 text-center text-sm text-gray-500">
              Use rear camera for better barcode scanning accuracy
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
