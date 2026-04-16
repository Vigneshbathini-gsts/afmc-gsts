import React, { useEffect, useState } from "react";
import { FaDownload, FaSearch } from "react-icons/fa";
import api from "../../../services/api";
import Stackreporttab from "./Stackreporttab";
import { exportTableToPdf } from "../../../utils/pdfExport";

const buildQueryParams = (filters) => {
  const params = {};
  Object.entries(filters).forEach(([key, value]) => {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed) params[key] = trimmed;
  });
  return params;
};

const formatNumber = (value, digits = 2) => {
  const num = Number(value);
  if (isNaN(num)) return "-";
  return num.toFixed(digits);
};

const formatQuantity = (value) => {
  if (!value) return "-";
  if (String(value).toUpperCase() === "TOTAL") return "Total";
  return Number(value);
};

export default function Orderitemdetails() {
  const initialFilters = {
    fromDate: "",
    toDate: "",
    itemNames: "",
    kitchenName: "",
    userName: "",
  };

  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [filterOptions, setFilterOptions] = useState({
    itemNames: [],
    userNames: [],
    kitchenNames: [],
  });
  const [filtersLoading, setFiltersLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const fetchFilterOptions = async () => {
      setFiltersLoading(true);
      try {
        const response = await api.get("/reports/orderitem/filter-options", {
          params: {
            fromDate: filters.fromDate,
            toDate: filters.toDate,
          },
        });

        if (response.data.success) {
          setFilterOptions(
            response.data.data || {
              itemNames: [],
              userNames: [],
              kitchenNames: [],
            }
          );
        }
      } catch (fetchError) {
        console.error(fetchError);
        setFilterOptions({
          itemNames: [],
          userNames: [],
          kitchenNames: [],
        });
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchFilterOptions();
  }, [filters.fromDate, filters.toDate]);

  const fetchData = async (activeFilters) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports/orderitem", {
        params: buildQueryParams(activeFilters),
      });
      if (res.data.success) {
        setData(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Unable to fetch item details report."
      );
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!filters.fromDate || !filters.toDate) {
      setHasSearched(false);
      setData([]);
      setError("Please select both From Date and To Date before searching.");
      return;
    }

    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    setHasSearched(true);
    setError("");
    await fetchData(nextFilters);
  };

  const exportPdf = () => {
    if (!data.length) return;

    exportTableToPdf({
      title: "Order Item Details Report",
      fileName: "order-item-details-report.pdf",
      subtitle: `From: ${appliedFilters.fromDate || "All"}   To: ${
        appliedFilters.toDate || "All"
      }`,
      headers: [
        "Item",
        "Qty",
        "Price",
        "Total Profit",
        "Unit Profit",
        "Prep Charges",
        "Profit %",
        "Total",
      ],
      rows: data.map((row) => [
        row.item_name || "-",
        String(formatQuantity(row.quantity)),
        row.price ? formatNumber(row.price) : "-",
        row.total_profit ? formatNumber(row.total_profit) : "-",
        row.unit_profit ? formatNumber(row.unit_profit) : "-",
        row.food_pr_charges ? formatNumber(row.food_pr_charges) : "-",
        row.totalprofit ? `${formatNumber(row.totalprofit, 0)}%` : "-",
        row.subtotal ? formatNumber(row.subtotal) : "-",
      ]),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 p-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <Stackreporttab />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-5 mb-5">
            <input
              type="date"
              name="fromDate"
              value={filters.fromDate}
              onChange={handleChange}
              className="input"
            />
            <input
              type="date"
              name="toDate"
              value={filters.toDate}
              onChange={handleChange}
              className="input"
            />
            <select
              name="itemNames"
              value={filters.itemNames}
              onChange={handleChange}
              className="input"
              disabled={filtersLoading}
            >
              <option value="">
                {filtersLoading ? "Loading items..." : "Select Item Name"}
              </option>
              {filterOptions.itemNames.map((itemName) => (
                <option key={itemName} value={itemName}>
                  {itemName}
                </option>
              ))}
            </select>
            <select
              name="kitchenName"
              value={filters.kitchenName}
              onChange={handleChange}
              className="input"
              disabled={filtersLoading}
            >
              <option value="">
                {filtersLoading ? "Loading kitchens..." : "Select Kitchen Name"}
              </option>
              {filterOptions.kitchenNames.map((kitchenName) => (
                <option key={kitchenName} value={kitchenName}>
                  {kitchenName}
                </option>
              ))}
            </select>
            <select
              name="userName"
              value={filters.userName}
              onChange={handleChange}
              className="input"
              disabled={filtersLoading}
            >
              <option value="">
                {filtersLoading ? "Loading users..." : "Select User Name"}
              </option>
              {filterOptions.userNames.map((userName) => (
                <option key={userName} value={userName}>
                  {userName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 mb-4">
            <button onClick={handleSearch} className="btn" disabled={loading}>
              <FaSearch size={16} /> {loading ? "Loading..." : "Search"}
            </button>
            <button
              onClick={exportPdf}
              className="btn"
              disabled={!data.length}
            >
              <FaDownload size={16} /> Download
            </button>
          </div>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          {!hasSearched ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              Select filters and click Search to view data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="th">Item</th>
                    <th className="th">Qty</th>
                    <th className="th">Total Profit</th>
                    <th className="th">Prep Charges</th>
                    <th className="th">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length ? (
                    data.map((row, i) => (
                      <tr
                        key={row.item_id || `${row.item_name || "row"}-${i}`}
                        className={`text-center border-t ${
                          !row.item_id ? "font-bold text-red-600" : ""
                        }`}
                      >
                        <td className="td">{row.item_name || "-"}</td>
                        <td className="td">{formatQuantity(row.quantity)}</td>
                        <td className="td">
                          {row.total_profit ? formatNumber(row.total_profit) : "-"}
                        </td>
                        <td className="td">
                          {row.food_pr_charges
                            ? formatNumber(row.food_pr_charges)
                            : "-"}
                        </td>
                        <td className="td">
                          {row.subtotal ? formatNumber(row.subtotal) : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="td text-center" colSpan="5">
                        No data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .input { padding: 8px; border: 1px solid #ccc; border-radius: 6px; width: 100%; }
        .btn { display: flex; gap: 5px; align-items: center; background: #6b5f5f; color: white; padding: 8px 14px; border-radius: 20px; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .th { padding: 10px }
        .td { padding: 10px }
      `}</style>
    </div>
  );
}
