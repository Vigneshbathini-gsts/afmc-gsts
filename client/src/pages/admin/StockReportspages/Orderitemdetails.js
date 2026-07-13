import React, { useEffect, useRef, useState } from "react";
import { FaDownload, FaSearch } from "react-icons/fa";
import { FaArrowLeft } from "react-icons/fa";
import api from "../../../services/api";
import Stackreporttab from "./Stackreporttab";
import { exportTableToPdf } from "../../../utils/pdfExport";
import FilterDropdown from "../../../components/common/FilterDropdown";
import { useNavigate } from "react-router-dom";
import { toInitCap } from "../../../utils/textFormat";

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

const getRowValue = (row, ...keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }
  return null;
};

const formatRowNumber = (row, keys, digits = 2) => {
  const value = getRowValue(row, ...keys);
  return value === null ? "-" : formatNumber(value, digits);
};

const formatQuantity = (value) => {
  if (!value) return "-";
  if (String(value).toUpperCase() === "TOTAL") return "Total";
  return Number(value);
};

const PEG_TYPE_SUFFIX = {
  SMALL: "(S)",
  LARGE: "(L)",
};

const getDisplayItemName = (row) => {
  const rawName = getRowValue(row, "item_name", "ITEM_NAME") || "-";
  const name = toInitCap(rawName);
  const pegType = getRowValue(row, "peg_type", "PEG_TYPE");
  if (!pegType) return name;

  const normalized = String(pegType).trim().toUpperCase();
  const suffix = PEG_TYPE_SUFFIX[normalized];
  return suffix ? `${name}${suffix}` : name;
};

const REPORT_PAGE_SIZE = 20;

export default function Orderitemdetails() {
  const navigate = useNavigate();
  const today = toInputDate(new Date());
  const initialFilters = {
    fromDate: today,
    toDate: today,
    itemNames: "",
    kitchenName: "",
    userName: "",
  };

  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState([]);
  const [summaryRow, setSummaryRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const requestInFlight = useRef(false);
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
          console.log("Filter options fetched:", response.data.data);
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

  const fetchData = async (activeFilters, { reset = true, nextPage = 0 } = {}) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError("");
    try {
      const res = await api.get("/reports/orderitem", {
        params: {
          ...buildQueryParams(activeFilters),
          limit: REPORT_PAGE_SIZE,
          offset: nextPage * REPORT_PAGE_SIZE,
        },
      });
      if (res.data.success) {
        const rows = res.data.data || [];
        const detailRows = rows.filter((row) => row?.item_id);
        const totalRow = rows.find((row) => !row?.item_id) || null;
        setData((current) => (reset ? detailRows : [...current, ...detailRows]));
        setSummaryRow(totalRow);
        setPage(nextPage + 1);
        setHasMore(detailRows.length === REPORT_PAGE_SIZE);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Unable to fetch item details report."
      );
      if (reset) {
        setData([]);
        setSummaryRow(null);
      }
      setHasMore(false);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setAppliedFilters(initialFilters);
    setHasSearched(true);
    fetchData(initialFilters, { reset: true, nextPage: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!filters.fromDate || !filters.toDate) {
      setHasSearched(false);
      setData([]);
      setSummaryRow(null);
      setError("Please select both From Date and To Date before searching.");
      return;
    }

    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    setHasSearched(true);
    setError("");
    setPage(0);
    setHasMore(true);
    await fetchData(nextFilters, { reset: true, nextPage: 0 });
  };

  const displayRows = summaryRow ? [...data, summaryRow] : data;

  const handleTableScroll = (event) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;

    if (
      scrollTop + clientHeight >= scrollHeight - 80 &&
      !loading &&
      !loadingMore &&
      hasMore
    ) {
      fetchData(appliedFilters, { reset: false, nextPage: page });
    }
  };

  const exportPdf = async () => {
    if (!data.length) return;

    const exportRows = [];
    let exportSummary = null;
    let offsetPage = 0;

    while (true) {
      const res = await api.get("/reports/orderitem", {
        params: {
          ...buildQueryParams(appliedFilters),
          limit: REPORT_PAGE_SIZE,
          offset: offsetPage * REPORT_PAGE_SIZE,
        },
      });
      const rows = res.data.data || [];
      const detailRows = rows.filter((row) => row?.item_id);
      exportSummary = rows.find((row) => !row?.item_id) || exportSummary;
      exportRows.push(...detailRows);
      if (detailRows.length < REPORT_PAGE_SIZE) break;
      offsetPage += 1;
    }

    const pdfRows = exportSummary ? [...exportRows, exportSummary] : exportRows;

    exportTableToPdf({
      title: "Order Item Details Report",
      fileName: "order-item-details-report.pdf",
      subtitle: `From: ${appliedFilters.fromDate || "All"}   To: ${
        appliedFilters.toDate || "All"
      }`,
      headers: [
        "Item",
        "Quantity",
        "Price",
        "Total Profit",
        "Unit Profit",
        "Prep Charges",
        "Profit %",
        "Total",
      ],
      rows: pdfRows.map((row) => [
        row.item_id ? getDisplayItemName(row) : "Total",
        String(formatQuantity(getRowValue(row, "quantity", "QUANTITY"))),
        formatRowNumber(row, ["price", "PRICE"]),
        formatRowNumber(row, ["total_profit", "TOTAL_PROFIT", "totalProfit"]),
        formatRowNumber(row, ["unit_profit", "UNIT_PROFIT", "unitProfit"]),
        formatRowNumber(row, ["food_pr_charges", "FOOD_PR_CHARGES", "foodPrCharges"]),
        getRowValue(row, "totalprofit", "TOTALPROFIT") !== null
          ? `${formatRowNumber(row, ["totalprofit", "TOTALPROFIT"], 0)}%`
          : "-",
        formatRowNumber(row, ["subtotal", "SUBTOTAL", "total", "TOTAL"]),
      ]),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 px-0 py-4 md:p-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Stock Reports
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="self-end sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow hover:shadow-md border border-afmc-gold/30 text-gray-700 hover:text-afmc-maroon hover:bg-afmc-maroon/5 transition max-w-max"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <Stackreporttab showTopBar={false} showReportTitle={false} />

        <div className="mt-8 bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From
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
                To
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
                Item Name
              </label>
              <FilterDropdown
                value={filters.itemNames}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, itemNames: next }))
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
                Kitchen Name
              </label>
              <FilterDropdown
                value={filters.kitchenName}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, kitchenName: next }))
                }
                options={filterOptions.kitchenNames}
                placeholder="Select Kitchen Name"
                allLabel="All Kitchens"
                loading={filtersLoading}
                loadingLabel="Loading kitchens..."
                formatLabel={toInitCap}
              />
            </div>

            <div className="col-start-2 md:col-start-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Name
              </label>
              <FilterDropdown
                value={filters.userName}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, userName: next }))
                }
                options={filterOptions.userNames}
                placeholder="Select User Name"
                allLabel="All Users"
                loading={filtersLoading}
                loadingLabel="Loading users..."
                formatLabel={toInitCap}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 mb-4">
            <button
              type="button"
              onClick={handleSearch}
              className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <FaSearch size={16} />
              {loading ? "Loading..." : "Search"}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="px-6 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold flex items-center gap-2 shadow hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={!data.length}
            >
              <FaDownload size={16} />
              Download
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!hasSearched ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 bg-white">
              Select filters and click Search to view data.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="max-h-[70vh] overflow-auto" onScroll={handleTableScroll}>
                <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Total Profit
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Prep Charges
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length ? (
                      displayRows.map((row, i) => (
                        <tr
                          key={
                            row.item_id
                              ? `${row.item_id}-${getRowValue(row, "peg_type", "PEG_TYPE") || "NA"}`
                              : `${row.item_name || "row"}-${i}`
                          }
                          className={`border-t border-gray-100 hover:bg-gray-50 ${
                            !row.item_id ? "font-bold text-red-600" : ""
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap capitalize">
                            {row.item_id ? getDisplayItemName(row) : "Total"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatQuantity(getRowValue(row, "quantity", "QUANTITY"))}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatRowNumber(row, ["total_profit", "TOTAL_PROFIT", "totalProfit"])}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatRowNumber(row, ["food_pr_charges", "FOOD_PR_CHARGES", "foodPrCharges"])}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {formatRowNumber(row, ["subtotal", "SUBTOTAL", "total", "TOTAL"])}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-gray-100">
                        <td className="px-4 py-6 text-center text-gray-500" colSpan="5">
                          No records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
                {loadingMore && (
                  <p className="px-4 py-4 text-center text-gray-500">
                    Loading more data...
                  </p>
                )}
                {!loading && !loadingMore && data.length > 0 && !hasMore && (
                  <p className="px-4 py-4 text-center text-gray-500">
                    No more data
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}