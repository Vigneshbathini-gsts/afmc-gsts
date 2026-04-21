import React, { useEffect, useState } from "react";
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
  Object.entries(filters).forEach(([key, value]) => {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed) params[key] = trimmed;
  });
  return params;
};

export default function OrderTransactionUI() {
  const navigate = useNavigate();
  const today = toInputDate(new Date());
  const initialFilters = {
    fromDate: today,
    toDate: today,
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
      subtitle: `From: ${appliedFilters.fromDate || "All"}   To: ${
        appliedFilters.toDate || "All"
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
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 p-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Stock Reports
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                Order Number
              </label>
              <input
                placeholder="Order Number"
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
          </div>

          <div className="flex flex-wrap justify-end gap-3 mb-4">
            <button
              type="button"
              className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSearch}
              disabled={loading}
            >
              <FaSearch size={16} />
              {loading ? "Loading..." : "Search"}
            </button>
            <button
              type="button"
              className="px-6 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold flex items-center gap-2 shadow hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={exportPdf}
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
              Enter filters and click Search to view data.
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
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Item Name
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        Profit %
                      </th>
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
                    {!data.length && !loading ? (
                      <tr className="border-t border-gray-100">
                        <td
                          className="px-4 py-6 text-center text-gray-500"
                          colSpan="7"
                        >
                          No records found.
                        </td>
                      </tr>
                    ) : (
                      data.map((row, index) => (
                        <tr
                          key={
                            row.ORDER_LINE_ID ||
                            `${row.ORDER_NUM || "total"}-${index}`
                          }
                          className="border-t border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            {row.ORDER_NUM || "-"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap capitalize">
                            {toInitCap(stripHtml(row.ITEM_NAME || "-"))}
                          </td>
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            dangerouslySetInnerHTML={{
                              __html: row.QUANTITY || "-",
                            }}
                          />
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            dangerouslySetInnerHTML={{
                              __html: row.TOTALPERCENT || "-",
                            }}
                          />
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            dangerouslySetInnerHTML={{
                              __html: row.TOTAL_PROFIT || "-",
                            }}
                          />
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            dangerouslySetInnerHTML={{
                              __html: row.FOOD_PR_CHARGES || "-",
                            }}
                          />
                          <td
                            className="px-4 py-3 whitespace-nowrap"
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
