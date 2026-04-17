import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { FaTimes } from "react-icons/fa";

export default function BarcodeScanner({ isOpen, onClose, onScan }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState("");
  const scannerElementId = "shared-barcode-scanner";

  useEffect(() => {
    if (!isOpen) return;

    const startScanner = async () => {
      try {
        setError("");
        const scanner = new Html5Qrcode(scannerElementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.7778,
          },
          async (decodedText) => {
            await stopScanner();
            onScan(decodedText);
            onClose();
          },
          () => {}
        );
      } catch (err) {
        console.error(err);
        setError("Camera access failed");
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen, onClose, onScan]);

  const stopScanner = async () => {
    if (!scannerRef.current) {
      return;
    }

    try {
      await scannerRef.current.stop();
    } catch (_error) {
      // Ignore stop errors when scanner is already idle.
    }

    try {
      await scannerRef.current.clear();
    } catch (_error) {
      // Ignore clear errors during teardown.
    }

    scannerRef.current = null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-xl font-bold text-afmc-maroon">Scan Barcode</h2>
          <button
            onClick={async () => {
              stopScanner();
              onClose();
            }}
            className="text-gray-600 hover:text-red-500 text-xl"
          >
            <FaTimes />
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-5 overflow-y-auto">
          {error ? (
            <div className="text-center text-red-500 font-medium">{error}</div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border shadow">
              <div id={scannerElementId} className="w-full min-h-[350px] bg-black" />
              <div className="absolute inset-0 border-4 border-afmc-maroon/40 pointer-events-none rounded-2xl"></div>
            </div>
          )}

          <p className="text-sm text-gray-500 text-center mt-4">
            Align the barcode inside the frame
          </p>
        </div>
      </div>
    </div>
  );
}
