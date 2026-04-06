import React, { useEffect, useState } from "react";
import { Search, Download } from "lucide-react";
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
    await fetchData(nextFilters);
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
    <div className="p-6 bg-gray-100 min-h-screen">
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
        </div>

        <div className="flex justify-end gap-3 mb-4">
          <button className="btn" onClick={handleSearch} disabled={loading}>
            <Search size={16} />
            {loading ? "Loading..." : "Search"}
          </button>
          <button className="btn" onClick={exportPdf} disabled={!data.length}>
            <Download size={16} />
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

      <style>{`
        .input {
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 8px;
          width: 100%;
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
