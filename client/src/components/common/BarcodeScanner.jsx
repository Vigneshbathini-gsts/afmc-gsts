import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { FaTimes } from "react-icons/fa";

export default function BarcodeScanner({ isOpen, onClose, onScan }) {
  const videoRef = useRef(null);
  const codeReader = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    codeReader.current = new BrowserMultiFormatReader();

    const startScanner = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        if (devices.length === 0) {
          setError("No camera found");
          return;
        }

        const selectedDeviceId = devices[0].deviceId;

        codeReader.current.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, err) => {
            if (result) {
              const scannedText = result.getText();
              onScan(scannedText);
              stopScanner();
              onClose();
            }
          }
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
  }, [isOpen]);

  const stopScanner = () => {
    if (codeReader.current) {
      codeReader.current.reset();
    }

    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-xl font-bold text-[#d70652]">Scan Barcode</h2>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="text-gray-600 hover:text-red-500 text-xl"
          >
            <FaTimes />
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-5">
          {error ? (
            <div className="text-center text-red-500 font-medium">{error}</div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border shadow">
              <video ref={videoRef} className="w-full h-[350px] object-cover" />
              <div className="absolute inset-0 border-4 border-[#d70652]/40 pointer-events-none rounded-2xl"></div>
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