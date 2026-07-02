import React, { useCallback, useMemo, useState } from "react";
import { FaCamera, FaSearch, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";
import BarcodeScanner from "../../components/common/BarcodeScanner";
import { inventoryAPI } from "../../services/api";

const STOCK_TYPE_OPTIONS = ["Purchased", "Free"];
const BATCH_WISE_SUB_CATEGORIES = new Set([6, 7, 9, 10, 18]);

const requiresVolume = (acUnit) => String(acUnit || "").trim().toUpperCase() !== "NOS";
const isValidBarcode = (value) => /^\d{4,15}$/.test(String(value || "").trim());
const isBatchWiseItem = (subCategoryId) => BATCH_WISE_SUB_CATEGORIES.has(Number(subCategoryId));

const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`;
};

const buildInitialStockForm = (item) => ({
  itemCode: item?.item_code || "",
  itemName: item?.item_name || "",
  transactionDate: formatDate(new Date()),
  acUnit: item?.ac_unit || "Nos",
  categoryId: item?.category_id || "",
  subCategoryId: item?.sub_category || "",
  itemGroup: item?.item_group || "",
  currentStock: item?.stock_quantity ?? 0,
  profit: item?.profit ?? "",
  rate: "",
  quantity: 1,
  volume: "",
  barcode: "",
  batchId: "",
  stockType: "Purchased",
  prepCharges: "",
});

export default function AddStockModal({
  item,
  currentLoggedInUser,
  onClose,
  onStockAdded,
}) {
  const [showLowerSection, setShowLowerSection] = useState(false);
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState("");
  const [stockInfo, setStockInfo] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [stockForm, setStockForm] = useState(() => buildInitialStockForm(item));
  const [stockRows, setStockRows] = useState([]);
  const [stockRowSearch, setStockRowSearch] = useState("");

  const closeStockModal = () => {
    setStockError("");
    setStockInfo("");
    setStockRows([]);
    setStockRowSearch("");
    onClose();
  };

  const stageStockRow = useCallback(async (barcodeValue = stockForm.barcode) => {
    const normalizedBarcode = String(barcodeValue || "").trim();

    if (!stockForm.itemCode || !stockForm.rate || !normalizedBarcode || !stockForm.transactionDate) {
      setStockError("Item code, barcode, rate, and transaction date are required.");
      return;
    }

    if (!Number.isFinite(Number(stockForm.rate)) || Number(stockForm.rate) <= 0) {
      setStockError("Unit selling rate must be greater than 0.");
      return;
    }

    if (!Number.isInteger(Number(stockForm.quantity)) || Number(stockForm.quantity) <= 0) {
      setStockError("Quantity must be a whole number greater than 0.");
      return;
    }

    if (!stockForm.stockType) {
      setStockError("Type is required.");
      return;
    }

    if (!isValidBarcode(normalizedBarcode)) {
      setStockError("Barcode must be 4 to 15 digits.");
      return;
    }

    if (requiresVolume(stockForm.acUnit) && !String(stockForm.volume || "").trim()) {
      setStockError("Volume is required for the selected type.");
      return;
    }

    if (stockRows.some((row) => row.barcode === normalizedBarcode)) {
      setStockError("This barcode is already staged.");
      return;
    }

    setStockError("");
    setStockInfo("");

    try {
      const response = await inventoryAPI.checkBarcodeExists(normalizedBarcode);
      if (response.data?.exists) {
        setStockError("This barcode already exists.");
        return;
      }
    } catch (err) {
      console.error("Failed to verify barcode:", err);
      setStockError("Unable to verify barcode uniqueness.");
      return;
    }

    const numericQuantity = Number(stockForm.quantity);
    const quantityLabel = isBatchWiseItem(stockForm.subCategoryId)
      ? "Quantity"
      : "No of Pegs/Quantity";

    setStockRows((current) => [
      ...current,
      {
        itemCode: stockForm.itemCode,
        itemName: stockForm.itemName,
        quantity: numericQuantity,
        barcode: normalizedBarcode,
        batchName: `${stockForm.itemName}-${numericQuantity}-${stockForm.volume || ""}-${formatDisplayDate(
          stockForm.transactionDate
        )}`,
        quantityLabel,
        rate: stockForm.rate,
        transactionDate: stockForm.transactionDate,
        displayTransactionDate: formatDisplayDate(stockForm.transactionDate),
        volume: stockForm.volume,
        batchId: stockForm.batchId,
        acUnit: stockForm.acUnit,
        categoryId: stockForm.categoryId,
        subCategoryId: stockForm.subCategoryId,
        itemGroup: stockForm.itemGroup,
        currentStock: stockForm.currentStock,
        profit: stockForm.profit,
        stockType: stockForm.stockType,
        prepCharges: stockForm.prepCharges,
      },
    ]);

    setShowLowerSection(true);
    setStockInfo("Stock row staged.");
    setStockForm((prev) => ({ ...prev, barcode: "" }));
  }, [stockForm, stockRows]);

  const handleStageStock = async () => {
    await stageStockRow(stockForm.barcode);
  };

  const handleScan = useCallback(
    async (scannedValue) => {
      const normalizedBarcode = String(scannedValue || "").trim();
      setScannerOpen(false);
      setStockForm((prev) => ({ ...prev, barcode: normalizedBarcode }));
      if (stockForm.itemCode && stockForm.rate && stockForm.transactionDate) {
        await stageStockRow(normalizedBarcode);
      } else {
        setStockInfo("Scanned. Enter rate/date and click Add Stock to stage.");
      }
    },
    [stageStockRow, stockForm.itemCode, stockForm.rate, stockForm.transactionDate]
  );

  const handleDeleteStockRow = (barcode) => {
    setStockRows((current) => current.filter((row) => row.barcode !== barcode));
  };

  const handleCancelStockRows = () => {
    setStockRows([]);
    setShowLowerSection(false);
    setStockRowSearch("");
    setStockError("");
  };

  const handleStockPrepChargesChange = (value) => {
    setStockForm((prev) => ({ ...prev, prepCharges: value }));
    setStockRows((current) =>
      current.map((row) => ({
        ...row,
        prepCharges: row.prepCharges || value,
      }))
    );
  };

  const handleAddStock = async () => {
    if (stockRows.length === 0) {
      const validationMessage = "Add at least one stock row before saving.";
      setStockError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    if (!stockForm.prepCharges && stockRows.some((row) => !row.prepCharges)) {
      toast.error("Preparation charges selection is required.");
      return;
    }

    setStockSaving(true);
    setStockError("");
    try {
      await inventoryAPI.addStock({
        items: stockRows.map((row) => ({
          itemCode: row.itemCode,
          quantity: row.quantity,
          transactionDate: row.transactionDate,
          volume: row.volume,
          barcode: row.barcode,
          rate: row.rate,
          batchId: row.batchId,
          prepCharges: row.prepCharges || stockForm.prepCharges,
          acUnit: row.acUnit,
          stockType: row.stockType,
          createdBy: currentLoggedInUser,
        })),
      });
      toast.success("Stock added successfully");
      closeStockModal();
      onStockAdded?.();
    } catch (err) {
      const addStockError = err.response?.data?.message || "Failed to add stock.";
      console.error("Failed to add stock:", err);
      setStockError(addStockError);
      toast.error(addStockError);
    } finally {
      setStockSaving(false);
    }
  };

  const filteredStockRows = useMemo(() => {
    const query = stockRowSearch.trim().toLowerCase();
    if (!query) return stockRows;
    return stockRows.filter((row) =>
      [
        row.itemName,
        row.barcode,
        row.batchName,
        row.volume,
        row.rate,
        row.stockType,
        row.displayTransactionDate,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [stockRowSearch, stockRows]);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-6">
        <div className="mx-auto w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-white/70 relative max-h-[calc(100vh-3rem)] overflow-y-auto pt-0 px-8 pb-8">
          <div className="sticky top-0 z-20 -mx-8 mb-6 flex items-center justify-end border-b border-gray-100 bg-white px-8 py-4 rounded-t-3xl shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStageStock}
                className="px-6 py-2.5 rounded-full bg-afmc-maroon text-white font-semibold shadow-afmc hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50 disabled:opacity-70"
              >
                Add
              </button>
              <button
                type="button"
                onClick={closeStockModal}
                className="px-6 py-2.5 rounded-full bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {stockError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {stockError}
            </div>
          )}

          {stockInfo && !stockError && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {stockInfo}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReadOnlyField label="Item Name" value={stockForm.itemName} />
            <ReadOnlyField label="Item Group" value={stockForm.itemGroup} />
            <ReadOnlyField label="Accounting Unit" value={stockForm.acUnit} />
            <ReadOnlyField label="Current Stock" value={stockForm.currentStock} />
            <ReadOnlyField label="Profit %" value={stockForm.profit} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Date
              </label>
              <input
                type="date"
                value={stockForm.transactionDate}
                onChange={(e) =>
                  setStockForm((prev) => ({ ...prev, transactionDate: e.target.value }))
                }
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
              />
            </div>

          

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isBatchWiseItem(stockForm.subCategoryId)
                  ? "Quantity"
                  : "No of Pegs/Quantity"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                value={stockForm.quantity}
                maxLength={8}
                onChange={(e) => {
                  let v = String(e.target.value || "");
                  v = v.replace(/[^0-9]/g, "");
                  v = v.slice(0, 8);
                  setStockForm((prev) => ({ ...prev, quantity: v }));
                }}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Selling Rate
              </label>
              <input
                type="text"
                inputMode="decimal"
                min="0"
                step="any"
                value={stockForm.rate}
                maxLength={12}
                onChange={(e) => {
                  let v = String(e.target.value || "");
                  v = v.replace(/e/gi, "");
                  v = v.replace(/[^0-9.]/g, "");
                  const parts = v.split(".");
                  if (parts.length > 2) v = `${parts[0]}.${parts.slice(1).join("")}`;
                  v = v.slice(0, 12);
                  setStockForm((prev) => ({ ...prev, rate: v }));
                }}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Volume
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={stockForm.volume}
                maxLength={10}
                onChange={(e) => {
                  let v = String(e.target.value || "");
                  v = v.replace(/[^0-9]/g, "");
                  v = v.slice(0, 10);
                  setStockForm((prev) => ({ ...prev, volume: v }));
                }}
                placeholder="e.g., 750"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Batch ID
              </label>
              <input
                type="text"
                value={stockForm.batchId}
                maxLength={50}
                onChange={(e) =>
                  setStockForm((prev) => ({ ...prev, batchId: e.target.value }))
                }
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barcode
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={stockForm.barcode}
                  inputMode="text"
                  pattern="[0-9]*"
                  maxLength={15}
                  onChange={(e) => {
                    const v = String(e.target.value || "").slice(0, 15);
                    setStockForm((prev) => ({ ...prev, barcode: v }));
                  }}
                  placeholder="Scan or type barcode"
                  className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#d70652] px-5 py-3 font-semibold text-white shadow hover:shadow-md"
                  title="Open scanner"
                >
                  <FaCamera />
                  Scan
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Tip: After scanning, the row auto-stages when rate/date are filled.
              </p>
            </div>

            <div className="lg:col-span-2 flex items-center gap-6">
              <span className="text-sm font-medium text-gray-700">
                Preparation Charges
              </span>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="stockPrep"
                  value="N"
                  checked={stockForm.prepCharges === "N"}
                  onChange={(e) => handleStockPrepChargesChange(e.target.value)}
                />
                No
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="stockPrep"
                  value="Y"
                  checked={stockForm.prepCharges === "Y"}
                  onChange={(e) => handleStockPrepChargesChange(e.target.value)}
                />
                Yes
              </label>
            </div>
          </div>

          {showLowerSection && (
            <div className="mt-8 rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                <button
                  type="button"
                  onClick={handleCancelStockRows}
                  className="rounded-full bg-gray-600 px-5 py-2.5 text-white font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAddStock}
                  disabled={stockSaving || stockRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-afmc-maroon px-5 py-2.5 text-white font-semibold shadow-afmc hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50 disabled:opacity-70"
                >
                  {stockSaving ? "Saving..." : "Add Stock"}
                </button>
              </div>

              <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
                <FaSearch className="text-gray-400" />
                <input
                  type="text"
                  value={stockRowSearch}
                  onChange={(e) => setStockRowSearch(e.target.value)}
                  placeholder="Search staged rows"
                  maxLength={100}
                  className="w-40 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none"
                />
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700"
                >
                  Go
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Item Name</th>
                      <th className="px-4 py-3 text-left font-medium">Quantity</th>
                      <th className="px-4 py-3 text-left font-medium">Barcode</th>
                      <th className="px-4 py-3 text-left font-medium">Batchname</th>
                      <th className="px-4 py-3 text-left font-medium">Rate</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Transaction Date</th>
                      <th className="px-4 py-3 text-left font-medium">Volume</th>
                      <th className="px-4 py-3 text-left font-medium">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStockRows.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                          No staged stock rows yet.
                        </td>
                      </tr>
                    ) : (
                      filteredStockRows.map((row) => (
                        <tr key={row.barcode} className="border-t border-gray-100">
                          <td className="px-4 py-3">{row.itemName}</td>
                          <td className="px-4 py-3">{row.quantity}</td>
                          <td className="px-4 py-3">{row.barcode}</td>
                          <td className="px-4 py-3">{row.batchName}</td>
                          <td className="px-4 py-3">{row.rate}</td>
                          <td className="px-4 py-3">{row.stockType}</td>
                          <td className="px-4 py-3">{row.displayTransactionDate}</td>
                          <td className="px-4 py-3">{row.volume}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteStockRow(row.barcode)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-red-600 hover:bg-red-50"
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

              <div className="px-4 py-3 text-right text-sm text-gray-500">
                {filteredStockRows.length}-{stockRows.length}
              </div>
            </div>
          )}
        </div>
      </div>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        type="text"
        value={value}
        readOnly
        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
      />
    </div>
  );
}
