import React, { useEffect, useState } from "react";
import { FaDownload, FaFilter, FaSearch, FaTimes } from "react-icons/fa";
import api from "../../../services/api";
import Stackreporttab from "./Stackreporttab";
import { exportTableToPdf } from "../../../utils/pdfExport";

const buildQueryParams = (filters) => {
  const params = {};

  Object.entries(filters).forEach(([key, value]) => {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed) {
      params[key] = trimmed;
    }
  });

  return params;
};

const stripHtml = (value) =>
  typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value;

export default function OrderTransactionUI() {
  const initialFilters = {
    fromDate: "",
    toDate: "",
    orderNumber: "",
    userName: "",
    kitchenName: "",
    itemNames: "",
  };

  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    itemNames: [],
    userNames: [],
    kitchenNames: [],
  });
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  useEffect(() => {
    const fetchFilterOptions = async () => {
      setFiltersLoading(true);
      try {
        const response = await api.get(
          "/reports/ordertransaction/filter-options",
          {
            params: {
              fromDate: filters.fromDate,
              toDate: filters.toDate,
            },
          }
        );

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
      const { data: response } = await api.get("/reports/ordertransaction", {
        params: buildQueryParams(activeFilters),
      });

      if (response.success) {
        setData(response.data || []);
      } else {
        setError(response.message || "Unable to fetch order transactions.");
      }
    } catch (requestError) {
      console.error("API Error:", requestError);
      setError(
        requestError.response?.data?.message ||
          "Unable to fetch order transactions."
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
    setShowFilterModal(false);
    await fetchData(nextFilters);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setData([]);
    setHasSearched(false);
    setError("");
    setShowFilterModal(false);
  };

  const exportPdf = () => {
    if (!data.length) return;

    exportTableToPdf({
      title: "Order Transaction Details Report",
      fileName: "order-transaction-details-report.pdf",
      subtitle: `From: ${appliedFilters.fromDate || "All"}   To: ${appliedFilters.toDate || "All"}`,
      headers: [
        "Order Number",
        "User",
        "Kitchen",
        "Item Name",
        "Quantity",
        "Profit %",
        "Total Profit",
        "Preparation Charges",
        "Subtotal",
      ],
      rows: data.map((row) => [
        row.ORDER_NUM || "-",
        row.FIRST_NAME || "-",
        stripHtml(row.PUBMED_NAME) || "-",
        stripHtml(row.ITEM_NAME) || "-",
        stripHtml(row.QUANTITY) || "-",
        stripHtml(row.TOTALPERCENT) || "-",
        stripHtml(row.TOTAL_PROFIT) || "-",
        stripHtml(row.FOOD_PR_CHARGES) || "-",
        stripHtml(row.SUBTOTAL) || "-",
      ]),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-[#d70652]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#ff025e]/10 rounded-full blur-3xl"></div>

<<<<<<< HEAD
      <div className="relative z-10 p-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <Stackreporttab />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 mt-6">
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
            <input
              placeholder="Order Number"
              name="orderNumber"
              value={filters.orderNumber}
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
=======
        <div className="flex justify-end gap-3 mb-4">
          <button className="btn" onClick={() => setShowFilterModal(true)}>
            <FaFilter size={16} />
            Filters
          </button>
          <button className="btn" onClick={handleSearch} disabled={loading}>
            <FaSearch size={16} />
            {loading ? "Loading..." : "Search"}
          </button>
          <button className="btn" onClick={exportPdf} disabled={!data.length}>
            <FaDownload size={16} />
            Download
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {!hasSearched ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            Enter filters and click Search to view data.
>>>>>>> 55d10ea2d20a23f6c0c06d524019f36849c4781e
          </div>

          <div className="flex justify-end gap-3 mb-4">
            <button className="btn" onClick={handleSearch} disabled={loading}>
              <FaSearch size={16} />
              {loading ? "Loading..." : "Search"}
            </button>
            <button className="btn" onClick={exportPdf} disabled={!data.length}>
              <FaDownload size={16} />
              Download
            </button>
          </div>

          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

          {!hasSearched ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
              Enter filters and click Search to view data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border rounded-lg">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="th">Order Number</th>
                    {/* <th className="th">User</th> */}
                    {/* <th className="th">Kitchen</th> */}
                    <th className="th">Item Name</th>
                    <th className="th">Quantity</th>
                    <th className="th">Profit %</th>
                    <th className="th">Total Profit</th>
                    <th className="th">Preparation Charges</th>
                    <th className="th">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.length && !loading ? (
                    <tr className="text-center border-t">
                      <td className="td" colSpan="9">
                        No data found.
                      </td>
                    </tr>
                  ) : (
                    data.map((row, index) => (
                      <tr
                        key={row.ORDER_LINE_ID || `${row.ORDER_NUM || "total"}-${index}`}
                        className="text-center border-t"
                      >
                        <td className="td">{row.ORDER_NUM || "-"}</td>
                        {/* <td className="td">{row.FIRST_NAME || "-"}</td> */}
                        {/* <td
                          className="td"
                          dangerouslySetInnerHTML={{
                            __html: row.PUBMED_NAME || "-",
                          }}
                        /> */}
                        <td
                          className="td"
                          dangerouslySetInnerHTML={{
                            __html: row.ITEM_NAME || "-",
                          }}
                        />
                        <td
                          className="td"
                          dangerouslySetInnerHTML={{
                            __html: row.QUANTITY || "-",
                          }}
                        />
                        <td
                          className="td"
                          dangerouslySetInnerHTML={{
                            __html: row.TOTALPERCENT || "-",
                          }}
                        />
                        <td
                          className="td"
                          dangerouslySetInnerHTML={{
                            __html: row.TOTAL_PROFIT || "-",
                          }}
                        />
                        <td
                          className="td"
                          dangerouslySetInnerHTML={{
                            __html: row.FOOD_PR_CHARGES || "-",
                          }}
                        />
                        <td
                          className="td"
                          dangerouslySetInnerHTML={{
                            __html: row.SUBTOTAL || "-",
                          }}
                        />
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Filter Report</h2>
                <p className="text-sm text-gray-500">
                  Choose the filters you want to apply to the transaction report.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <FaTimes size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">From Date</label>
                <input
                  type="date"
                  name="fromDate"
                  value={filters.fromDate}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="label">To Date</label>
                <input
                  type="date"
                  name="toDate"
                  value={filters.toDate}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Order Number</label>
                <input
                  placeholder="Enter order number"
                  name="orderNumber"
                  value={filters.orderNumber}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Item Name</label>
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
              </div>
              <div>
                <label className="label">User Name</label>
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
              <div>
                <label className="label">Kitchen Name</label>
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
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                Clear
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowFilterModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={handleSearch} disabled={loading}>
                <FaSearch size={16} />
                {loading ? "Loading..." : "Apply Filters"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input {
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 8px;
          width: 100%;
        }
        .label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }
        .btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #6b5f5f;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          border: none;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .th {
          padding: 10px;
          text-align: center;
          white-space: nowrap;
        }
        .td {
          padding: 10px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
