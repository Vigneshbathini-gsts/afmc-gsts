import React, { useCallback, useMemo, useState } from "react";
import {
  FaArrowLeft,
  FaBarcode,
  FaCamera,
  FaCheckCircle,
  FaSearch,
  FaTrash,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import BarcodeScanner from "../../components/common/BarcodeScanner";
import { inventoryAPI } from "../../services/api";

const toInputDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AddItem() {
  const navigate = useNavigate();
  const [barcode, setBarcode] = useState("");
  const [transactionDate, setTransactionDate] = useState(toInputDate(new Date()));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const createdBy = useMemo(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (!rawUser) return "ADMIN";
      const user = JSON.parse(rawUser);
      return user?.username || user?.email || user?.user_name || user?.name || "ADMIN";
    } catch (_error) {
      return "ADMIN";
    }
  }, []);

  const addBarcodeRow = useCallback(
    async (barcodeValue) => {
      const normalizedBarcode = String(barcodeValue || "").trim();
      if (!normalizedBarcode) {
        setError("Barcode is required.");
        return;
      }

      if (!transactionDate) {
        setError("Transaction date is required.");
        return;
      }

      if (rows.some((row) => String(row.barcode) === normalizedBarcode)) {
        setError("This barcode is already added.");
        return;
      }

      setLoading(true);
      setError("");
      setSuccessMessage("");
      try {
        const response = await inventoryAPI.getStockOutItemByBarcode(normalizedBarcode);
        const item = response.data.data;

        setRows((current) => [
          ...current,
          {
            itemCode: item.item_code,
            itemName: item.item_name,
            quantity: 1,
            unitPrice: Number(item.unit_price || 0),
            transactionDate,
            barcode: normalizedBarcode,
            volume: item.volume || "",
            batchName: item.batch_name || "",
            acUnit: item.ac_unit || "Nos",
            pegs: Number(item.pegs || 0),
            availableStock: Number(item.available_stock || 0),
          },
        ]);
        setBarcode("");
      } catch (requestError) {
        console.error("Failed to fetch barcode item:", requestError);
        setError(requestError.response?.data?.message || "Unable to fetch item for barcode.");
      } finally {
        setLoading(false);
      }
    },
    [rows, transactionDate]
  );

  const handleBarcodeSubmit = async () => {
    await addBarcodeRow(barcode);
  };

  const handleKeyDown = async (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      await handleBarcodeSubmit();
    }
  };

  const handleScan = useCallback(
    async (scannedValue) => {
      await addBarcodeRow(scannedValue);
    },
    [addBarcodeRow]
  );

  const handleScannerClose = useCallback(() => {
    setScannerOpen(false);
  }, []);

  const handleQuantityChange = (index, value) => {
    const nextQuantity = value === "" ? "" : Math.max(0, Number(value));
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              quantity: nextQuantity,
            }
          : row
      )
    );
  };

  const handleDeleteRow = (index) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleCancel = () => {
    setRows([]);
    setBarcode("");
    setError("");
    setSuccessMessage("");
  };

  const handleFinish = async () => {
    const invalidRow = rows.find((row) => !row.quantity || Number(row.quantity) <= 0);
    if (invalidRow) {
      setError("Every row must have a quantity greater than 0.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      await inventoryAPI.createStockOut({
        items: rows.map((row) => ({
          barcode: row.barcode,
          quantity: Number(row.quantity),
          transactionDate,
          createdBy,
        })),
      });

      setRows([]);
      setBarcode("");
      setSuccessMessage("Stock-out transaction completed successfully.");
    } catch (requestError) {
      console.error("Failed to save stock-out transaction:", requestError);
      setError(
        requestError.response?.data?.message || "Unable to complete stock-out transaction."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative overflow-hidden">
      <div className="absolute top-16 left-12 w-72 h-72 rounded-full bg-[#d70652]/10 blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-[#ff025e]/10 blur-3xl"></div>

      <div className="relative z-10 p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Barcode Reader</h1>
            <p className="mt-1 text-sm text-gray-500">
              Scan or enter a barcode to stage stock-out rows, then finish to post them.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-gray-700 shadow hover:shadow-md border border-white/60"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-[1fr_220px_auto]">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Barcode</label>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <FaBarcode className="text-gray-400" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Scan or enter barcode"
                  className="w-full bg-transparent text-gray-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Transaction Date
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBarcodeSubmit}
                disabled={loading}
                className="flex items-center gap-2 rounded-2xl bg-[#5b5b5b] px-5 py-3 font-semibold text-white shadow hover:shadow-md disabled:opacity-70"
              >
                <FaSearch />
                {loading ? "Adding..." : "Add"}
              </button>

              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-[#d70652] px-5 py-3 font-semibold text-white shadow hover:shadow-md"
              >
                <FaCamera />
                Scan
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <FaCheckCircle />
              {successMessage}
            </div>
          )}

          <div className="mt-8 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">S.No</th>
                  <th className="px-4 py-3 text-left font-medium">Item Code</th>
                  <th className="px-4 py-3 text-left font-medium">Item Name</th>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                  <th className="px-4 py-3 text-left font-medium">Unit Price</th>
                  <th className="px-4 py-3 text-left font-medium">Transaction Date</th>
                  <th className="px-4 py-3 text-left font-medium">Barcode</th>
                  <th className="px-4 py-3 text-left font-medium">Volume</th>
                  <th className="px-4 py-3 text-left font-medium">Batch Name</th>
                  <th className="px-4 py-3 text-left font-medium">Del</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                      No staged stock-out items yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.barcode}-${index}`} className="border-t border-gray-100">
                      <td className="px-4 py-3">{index + 1}</td>
                      <td className="px-4 py-3">{row.itemCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.itemName}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={row.quantity}
                          onChange={(event) => handleQuantityChange(index, event.target.value)}
                          className="w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
                        />
                      </td>
                      <td className="px-4 py-3">{row.unitPrice}</td>
                      <td className="px-4 py-3">{row.transactionDate}</td>
                      <td className="px-4 py-3">{row.barcode}</td>
                      <td className="px-4 py-3">{row.volume || "-"}</td>
                      <td className="max-w-[180px] truncate px-4 py-3" title={row.batchName}>
                        {row.batchName || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(index)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full bg-[#5b5b5b] px-6 py-3 font-semibold text-white"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleFinish}
              disabled={saving || rows.length === 0}
              className="flex items-center gap-2 rounded-full bg-green-700 px-8 py-3 font-semibold text-white disabled:opacity-70"
            >
              <FaCheckCircle />
              {saving ? "Finishing..." : "Finish"}
            </button>
          </div>
        </div>
      </div>

      <BarcodeScanner isOpen={scannerOpen} onClose={handleScannerClose} onScan={handleScan} />
    </div>
  );
}
