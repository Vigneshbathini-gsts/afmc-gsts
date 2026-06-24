import React, { useCallback, useState, useEffect } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { inventoryAPI } from "../../services/api";

const formatDisplayDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
};

export default function TodayStockOutDetails() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await inventoryAPI.getTodayStockOutDetails();
      setRows(response.data.data || []);
    } catch (err) {
      console.error("Failed to load today's stock-out details:", err);
      setError("Failed to load today's stock-out details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="px-0 py-4 md:p-8 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">
            Today's Stock Out Details
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-white/60 text-gray-700"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Item Code</th>

                  <th className="px-4 py-3 text-left font-medium">Item Name</th>
                  <th className="px-4 py-3 text-left font-medium">Stock</th>
                  <th className="px-4 py-3 text-left font-medium">Unit Price</th>

                  <th className="px-4 py-3 text-left font-medium">Batch Name</th>

                  <th className="px-4 py-3 text-left font-medium">Volume</th>
                  <th className="px-4 py-3 text-left font-medium">Transaction Date</th>

                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="17" className="px-4 py-6 text-center text-gray-500">
                      Loading report...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan="17" className="px-4 py-6 text-center text-gray-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={`${row.ITEM_ID}-${idx}`} className="border-t border-gray-100">
                      <td className="px-4 py-3">{row.ITEM_CODE}</td>
                      <td className="px-4 py-3">{row.ITEM_NAME}</td>
                      <td className="px-4 py-3">{row.stock_quantity}</td>
                      <td className="px-4 py-3">{row.UNIT_PRICE}</td>
                      <td className="px-4 py-3">{row.batch_name}</td>
                      <td className="px-4 py-3">{row.volume}</td>
                      <td className="px-4 py-3">{formatDisplayDate(row.CREATION_DATE)}</td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}