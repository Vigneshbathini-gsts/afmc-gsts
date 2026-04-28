import React, { useEffect, useMemo, useState } from "react";
import { FaDownload, FaSearch } from "react-icons/fa";
import { FaArrowLeft } from "react-icons/fa";
import api from "../../../services/api";
import Stackreporttab from "./Stackreporttab";
import { exportTableToPdf } from "../../../utils/pdfExport";
import FilterDropdown from "../../../components/common/FilterDropdown";
import { useNavigate } from "react-router-dom";
import { stripHtml, toInitCap } from "../../../utils/textFormat";

const toInputDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const buildQueryParams = (filters) => {
  const params = {};
  const clean = (value) => (typeof value === "string" ? value.trim() : "");

  const fromDate = clean(filters.fromDate);
  const toDate = clean(filters.toDate);
  const orderNumber = clean(filters.orderNumber);
  const userName = clean(filters.userName);
  const kitchenName = clean(filters.kitchenName);
  const itemNames = clean(filters.itemNames);

  // Only add non-empty values to params
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  if (orderNumber) params.orderNumber = orderNumber;
  if (userName) params.userName = userName;
  if (kitchenName) params.kitchenName = kitchenName;
  if (itemNames) params.itemNames = itemNames;

  return params;
};

const normalizeDropdownOptions = (options) => {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => {
      if (typeof option === "string" || typeof option === "number") {
        const value = String(option).trim();
        return value ? { label: value, value } : null;
      }

      if (!option || typeof option !== "object") return null;

      const label = String(
        option.label ?? option.name ?? option.title ?? option.D ?? option.d ?? option.value ?? ""
      ).trim();
      const value = String(
        option.value ?? option.id ?? option.key ?? option.R ?? option.r ?? option.label ?? ""
      ).trim();

      return label && value ? { label, value } : null;
    })
    .filter(Boolean);
};

export default function OrderTransactionUI() {
  const navigate = useNavigate();
  const today = useMemo(() => toInputDate(new Date()), []);
  const initialFilters = useMemo(
    () => ({
      fromDate: today,
      toDate: today,
      orderNumber: "",
      userName: "",
      kitchenName: "",
      itemNames: "",
    }),
    [today]
  );

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

  const parseNumber = (value) => {
    if (value === null || value === undefined) return 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    const normalized = raw.replace(/[, ]+/g, "").replace(/[^\d.-]/g, "");
    const numberValue = Number(normalized);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  // Fetch filter options when component mounts
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setFiltersLoading(true);
      try {
        const [itemResponse, userResponse, kitchenResponse] = await Promise.all([
          api.get("/reports/ordertransaction/items"),
          api.get("/reports/ordertransaction/users"),
          api.get("/reports/ordertransaction/kitchens"),
        ]);

        setFilterOptions({
          itemNames: normalizeDropdownOptions(itemResponse.data?.data),
          userNames: normalizeDropdownOptions(userResponse.data?.data),
          kitchenNames: normalizeDropdownOptions(kitchenResponse.data?.data),
        });
      } catch (fetchError) {
        console.error("Error fetching filter options:", fetchError);
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
  }, []); // Empty dependency array - fetch only once on mount

  const fetchData = async (activeFilters) => {
    setLoading(true);
    setError("");

    try {
      const queryParams = buildQueryParams(activeFilters);
      const { data: response } = await api.get("/reports/ordertransaction", {
        params: queryParams,
      });

      if (response.success) {
        // Server may include a pre-calculated total row (e.g. ORD === 2). We compute totals
        // on the client so filtered/search results always show correct totals.
        const responseRows = Array.isArray(response.data) ? response.data : [];
        const detailRows = responseRows.filter((row) => row?.ORD !== 2);
        setData(detailRows);
        
        // if (detailRows.length === 0) {
        //   setError("No records found for the selected filters.");
        // }
      } else {
        setError(response.message || "Unable to fetch order transactions.");
        setData([]);
      }
    } catch (requestError) {
      console.error("API Error:", requestError);
      setError(
        requestError.response?.data?.message ||
          "Unable to fetch order transactions. Please try again."
      );
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load today's report on first open (dates are pre-filled).
    setAppliedFilters(initialFilters);
    setHasSearched(true);
    fetchData(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    // Validate dates
    if (!filters.fromDate || !filters.toDate) {
      setError("Please select both From Date and To Date before searching.");
      return;
    }

    // Validate date range
    if (filters.fromDate > filters.toDate) {
      setError("From Date cannot be greater than To Date.");
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

    const totals = data.reduce(
      (acc, row) => ({
        quantity: acc.quantity + parseNumber(row.QUANTITY),
        totalProfit: acc.totalProfit + parseNumber(row.TOTAL_PROFIT),
        prepCharges: acc.prepCharges + parseNumber(row.FOOD_PR_CHARGES),
        subtotal: acc.subtotal + parseNumber(row.SUBTOTAL),
      }),
      { quantity: 0, totalProfit: 0, prepCharges: 0, subtotal: 0 }
    );

    exportTableToPdf({
      title: "Order Transaction Details Report",
      fileName: `order-transaction-details-${new Date().toISOString().split('T')[0]}.pdf`,
      subtitle: `From: ${appliedFilters.fromDate || "All"} To: ${
        appliedFilters.toDate || "All"
      }${appliedFilters.orderNumber ? ` | Order No: ${appliedFilters.orderNumber}` : ""}${
        appliedFilters.userName ? ` | User: ${appliedFilters.userName}` : ""
      }${appliedFilters.kitchenName ? ` | Kitchen: ${appliedFilters.kitchenName}` : ""}${
        appliedFilters.itemNames ? ` | Item: ${appliedFilters.itemNames}` : ""
      }`,
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
      rows: [
        ...data.map((row) => [
          row.ORDER_NUM || "-",
          row.FIRST_NAME || "-",
          row.PUBMED_NAME || "-",
          stripHtml(row.ITEM_NAME) || "-",
          row.QUANTITY || "-",
          row.TOTALPERCENT || "-",
          row.TOTAL_PROFIT || "-",
          row.FOOD_PR_CHARGES || "-",
          row.SUBTOTAL || "-",
        ]),
        [
          "",
          "",
          "",
          "",
          "TOTAL",
          "",
          totals.totalProfit.toFixed(2),
          totals.prepCharges.toFixed(2),
          totals.subtotal.toFixed(2),
        ],
      ],
    });
  };

  const totals = useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        quantity: acc.quantity + parseNumber(row.QUANTITY),
        totalProfit: acc.totalProfit + parseNumber(row.TOTAL_PROFIT),
        prepCharges: acc.prepCharges + parseNumber(row.FOOD_PR_CHARGES),
        subtotal: acc.subtotal + parseNumber(row.SUBTOTAL),
      }),
      { quantity: 0, totalProfit: 0, prepCharges: 0, subtotal: 0 }
    );
  }, [data]);

  const formatMoney = (value) => {
    if (!Number.isFinite(value)) return "0.00";
    return value.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 p-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Order Transaction Reports
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-afmc-gold/30 text-gray-700 hover:text-afmc-maroon hover:bg-afmc-maroon/5 transition"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <Stackreporttab showTopBar={false} showReportTitle={false} />

        <div className="mt-8 bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="fromDate"
                value={filters.fromDate}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="toDate"
                value={filters.toDate}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Number
              </label>
              <input
                type="text"
                placeholder="Enter Order Number"
                name="orderNumber"
                value={filters.orderNumber}
                onChange={handleChange}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name
              </label>
              <FilterDropdown
                value={filters.itemNames}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, itemNames: next || "" }))
                }
                options={filterOptions.itemNames}
                placeholder="Select Item Name"
                allLabel="All Items"
                loading={filtersLoading}
                loadingLabel="Loading items..."
                formatLabel={toInitCap}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Name
              </label>
              <FilterDropdown
                value={filters.userName}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, userName: next || "" }))
                }
                options={filterOptions.userNames}
                placeholder="Select User Name"
                allLabel="All Users"
                loading={filtersLoading}
                loadingLabel="Loading users..."
                formatLabel={toInitCap}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kitchen Name
              </label>
              <FilterDropdown
                value={filters.kitchenName}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, kitchenName: next || "" }))
                }
                options={filterOptions.kitchenNames}
                placeholder="Select Kitchen Name"
                allLabel="All Kitchens"
                loading={filtersLoading}
                loadingLabel="Loading kitchens..."
                formatLabel={toInitCap}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 mb-4">
            <button
              type="button"
              className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSearch}
              disabled={loading}
            >
              <FaSearch size={16} />
              {loading ? "Searching..." : "Search"}
            </button>
            {/* <button
              type="button"
              className="px-6 py-3 rounded-2xl bg-gray-500 hover:bg-gray-600 text-white font-semibold flex items-center gap-2 shadow hover:shadow-md transition"
              onClick={handleReset}
            >
              Reset
            </button> */}
            
            <button
              type="button"
              className="px-6 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold flex items-center gap-2 shadow hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={exportPdf}
              disabled={!data.length || loading}
            >
              <FaDownload size={16} />
              Download PDF
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!hasSearched ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 bg-white">
              <p className="text-lg">Enter filters and click Search to view data.</p>
              <p className="text-sm mt-2">Date range is required for search.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Order Number
                      </th>
                      {/* <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        User Name
                      </th> */}
                      {/* <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Kitchen Name
                      </th> */}
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Item Name
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Quantity
                      </th>
                      {/* <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Profit %
                      </th> */}
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Total Profit
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Preparation Charges
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="text-center py-8">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afmc-maroon"></div>
                            <span className="ml-2">Loading data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-4 py-6 text-center text-gray-500">
                          No records found for the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {data.map((row, index) => (
                          <tr
                            key={row.ORDER_LINE_ID || `row-${index}`}
                            className="border-t border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.ORDER_NUM || "-"}
                            </td>
                            {/* <td className="px-4 py-3 whitespace-nowrap">
                              {row.FIRST_NAME || "-"}
                            </td> */}
                            {/* <td className="px-4 py-3 whitespace-nowrap">
                              {row.PUBMED_NAME || "-"}
                            </td> */}
                            <td className="px-4 py-3 whitespace-nowrap capitalize">
                              {toInitCap(stripHtml(row.ITEM_NAME || "-"))}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.QUANTITY || "-"}
                            </td>
                            {/* <td className="px-4 py-3 whitespace-nowrap">
                              {row.TOTALPERCENT || "-"}
                            </td> */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.TOTAL_PROFIT || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.FOOD_PR_CHARGES || "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.SUBTOTAL || "-"}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-gray-200 bg-gray-100 font-semibold">
                          <td className="px-4 py-3 whitespace-nowrap" />
                          <td className="px-4 py-3 whitespace-nowrap" />
                          <td className="px-4 py-3 whitespace-nowrap">TOTAL</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatMoney(totals.totalProfit)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatMoney(totals.prepCharges)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatMoney(totals.subtotal)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              {!loading && data.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                  Total Records: {data.length}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
