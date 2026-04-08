import React, { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaCheckCircle, FaPlusCircle, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { inventoryAPI } from "../../services/api";

const toInputDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export default function AddItem() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [barTypes, setBarTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formValues, setFormValues] = useState({
    itemCode: "",
    transactionDate: toInputDate(new Date()),
    acUnit: "",
    rate: "",
    volume: "",
    barcode: "",
    prepCharges: "N",
    batchId: "",
    quantity: 1,
  });

  const createdBy = useMemo(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (!rawUser) return "ADMIN";
      const user = JSON.parse(rawUser);
      return (
        user?.username ||
        user?.email ||
        user?.user_name ||
        user?.name ||
        "ADMIN"
      );
    } catch (_error) {
      return "ADMIN";
    }
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.item_code) === String(formValues.itemCode)) || null,
    [items, formValues.itemCode]
  );

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [itemsResponse, barTypesResponse] = await Promise.all([
          inventoryAPI.getAll(),
          inventoryAPI.getBarTypes(),
        ]);

        setItems(itemsResponse.data.data || []);
        setBarTypes(barTypesResponse.data.data || []);
      } catch (requestError) {
        console.error("Failed to load add stock options:", requestError);
        setError("Failed to load item options.");
      }
    };

    loadOptions();
  }, []);

  useEffect(() => {
    if (!selectedItem) return;

    setFormValues((current) => {
      if (String(current.itemCode) !== String(selectedItem.item_code)) {
        return current;
      }

      return {
        ...current,
        acUnit: selectedItem.ac_unit || "",
      };
    });
  }, [selectedItem]);

  const updateFormValue = (key, value) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleAdd = async () => {
    const normalizedBarcode = String(formValues.barcode || "").trim();

    if (!formValues.itemCode) {
      setError("Item name is required.");
      return;
    }

    if (!formValues.transactionDate || !formValues.acUnit || !formValues.rate || !formValues.volume || !normalizedBarcode) {
      setError("Transaction date, type, rate, volume, and barcode are required.");
      return;
    }

    if (rows.some((row) => String(row.barcode) === normalizedBarcode)) {
      setError("Duplicate Barcode");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await inventoryAPI.checkBarcodeExists(normalizedBarcode);
      if (response.data?.data?.exists) {
        setError("Duplicate Barcode");
        return;
      }

      const itemName = selectedItem?.item_name || "";
      const batchName = `${itemName}-${formValues.quantity}-${formValues.volume}-${formValues.transactionDate}`;

      setRows((current) => [
        ...current,
        {
          itemCode: Number(formValues.itemCode),
          itemName,
          quantity: Number(formValues.quantity),
          barcode: normalizedBarcode,
          batchName,
          rate: Number(formValues.rate),
          transactionDate: formValues.transactionDate,
          volume: formValues.volume,
          acUnit: formValues.acUnit,
          prepCharges: formValues.prepCharges,
          batchId: formValues.batchId,
        },
      ]);

      setFormValues((current) => ({
        ...current,
        rate: "",
        volume: "",
        barcode: "",
        batchId: "",
        quantity: 1,
      }));
    } catch (requestError) {
      console.error("Failed to validate barcode:", requestError);
      setError(requestError.response?.data?.message || "Unable to validate barcode.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRow = (index) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleCancel = () => {
    setRows([]);
    setError("");
    setSuccessMessage("");
    setFormValues((current) => ({
      ...current,
      rate: "",
      volume: "",
      barcode: "",
      batchId: "",
      quantity: 1,
    }));
  };

  const handleFinish = async () => {
    if (rows.length === 0) {
      setError("Add at least one row before saving.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await inventoryAPI.addStock({
        items: rows.map((row) => ({
          itemCode: row.itemCode,
          quantity: row.quantity,
          transactionDate: row.transactionDate,
          volume: row.volume,
          barcode: row.barcode,
          rate: row.rate,
          batchId: row.batchId,
          prepCharges: row.prepCharges,
          acUnit: row.acUnit,
          createdBy,
        })),
      });

      setRows([]);
      setSuccessMessage("Stock added successfully.");
      setFormValues((current) => ({
        ...current,
        rate: "",
        volume: "",
        barcode: "",
        batchId: "",
        quantity: 1,
      }));
    } catch (requestError) {
      console.error("Failed to add stock:", requestError);
      setError(requestError.response?.data?.message || "Unable to add stock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative overflow-hidden">
      <div className="absolute top-16 left-12 h-72 w-72 rounded-full bg-[#d70652]/10 blur-3xl"></div>
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-[#ff025e]/10 blur-3xl"></div>

      <div className="relative z-10 p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Item Transaction</h1>
            <p className="mt-1 text-sm text-gray-500">
              Stage stock-in rows and finish to post them to inventory.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 rounded-full bg-[#7b726d] px-5 py-2.5 text-white shadow hover:opacity-90"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Item Name
              </label>
              <select
                value={formValues.itemCode}
                onChange={(event) => updateFormValue("itemCode", event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.item_code} value={item.item_code}>
                    {item.item_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Transaction Date
              </label>
              <input
                type="date"
                value={formValues.transactionDate}
                onChange={(event) => updateFormValue("transactionDate", event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Type
              </label>
              <select
                value={formValues.acUnit}
                onChange={(event) => updateFormValue("acUnit", event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              >
                <option value="">Select type</option>
                {barTypes.map((type) => (
                  <option key={type.type_id} value={type.type}>
                    {type.type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Unit Selling Rate
              </label>
              <input
                type="number"
                value={formValues.rate}
                onChange={(event) => updateFormValue("rate", event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Volume
              </label>
              <input
                type="text"
                value={formValues.volume}
                onChange={(event) => updateFormValue("volume", event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Barcode
              </label>
              <input
                type="text"
                value={formValues.barcode}
                onChange={(event) => updateFormValue("barcode", event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Quantity
              </label>
              <input
                type="number"
                value={formValues.quantity}
                readOnly
                className="w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Batch ID
              </label>
              <input
                type="text"
                value={formValues.batchId}
                onChange={(event) => updateFormValue("batchId", event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
              />
            </div>

            <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-gray-700">
                  Preparation Charges
                </span>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="prepCharges"
                    value="N"
                    checked={formValues.prepCharges === "N"}
                    onChange={(event) => updateFormValue("prepCharges", event.target.value)}
                  />
                  N
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="prepCharges"
                    value="Y"
                    checked={formValues.prepCharges === "Y"}
                    onChange={(event) => updateFormValue("prepCharges", event.target.value)}
                  />
                  Y
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-full bg-green-700 px-6 py-3 font-semibold text-white disabled:opacity-70"
                >
                  <FaPlusCircle />
                  {loading ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/admin/dashboard")}
                  className="flex items-center gap-2 rounded-full bg-[#7b726d] px-6 py-3 font-semibold text-white"
                >
                  <FaArrowLeft />
                  Back
                </button>
              </div>
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
                  <th className="px-4 py-3 text-left font-medium">Barcode</th>
                  <th className="px-4 py-3 text-left font-medium">Batch ID</th>
                  <th className="px-4 py-3 text-left font-medium">Batchname</th>
                  <th className="px-4 py-3 text-left font-medium">Rate</th>
                  <th className="px-4 py-3 text-left font-medium">Transaction Date</th>
                  <th className="px-4 py-3 text-left font-medium">Volume</th>
                  <th className="px-4 py-3 text-left font-medium">Delete</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                      No staged stock items yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.barcode}-${index}`} className="border-t border-gray-100">
                      <td className="px-4 py-3">{index + 1}</td>
                      <td className="px-4 py-3">{row.itemCode}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.itemName}</td>
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">{row.barcode}</td>
                      <td className="px-4 py-3">{row.batchId || "-"}</td>
                      <td className="px-4 py-3">{row.batchName}</td>
                      <td className="px-4 py-3">{row.rate}</td>
                      <td className="px-4 py-3">{row.transactionDate}</td>
                      <td className="px-4 py-3">{row.volume}</td>
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
              {saving ? "Saving..." : "Add Stock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
