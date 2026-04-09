import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronsLeft,
  Search,
  CalendarDays,
} from "lucide-react";
import { orderAPI } from "../../services/api";
import { exportTableToPdf } from "../../utils/pdfExport";

const formatDateForApi = (value) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return amount.toFixed(2);
};

const getInitialFilters = () => {
  return {
    from: "",
    to: "",
    username: "",
  };
};

export default function OrderHistory() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(getInitialFilters);
  const [searchValue, setSearchValue] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const appUser = useMemo(() => {
    try {
      const storedUser = localStorage.getItem("authUser");
      const parsed = storedUser ? JSON.parse(storedUser) : null;
      return parsed?.username || "";
    } catch (parseError) {
      return "";
    }
  }, []);

  const loadOrders = useCallback(
    async (activeFilters) => {
      try {
        setLoading(true);
        setError("");

        const response = await orderAPI.getOrderHistory({
          from: formatDateForApi(activeFilters.from),
          to: formatDateForApi(activeFilters.to),
          username: activeFilters.username.trim() || null,
          app_user: appUser || null,
        });

        setRows(response.data?.data || []);
      } catch (fetchError) {
        console.error("Failed to fetch order history:", fetchError);
        setRows([]);
        setError(
          fetchError.response?.data?.message || "Unable to load order history."
        );
      } finally {
        setLoading(false);
      }
    },
    [appUser]
  );

  const visibleRows = useMemo(() => {
    const term = quickSearch.trim().toLowerCase();

    if (!term) {
      return rows;
    }

    return rows.filter((row) => {
      if (row?.payment_status1 === "Total") {
        return true;
      }

      return [
        row?.order_num,
        row?.order_date,
        row?.first_name,
        row?.status,
        row?.payment_method,
        row?.payment_status1,
        row?.subtotal,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [quickSearch, rows]);

  const userOptions = useMemo(() => {
    const names = rows
      .map((row) => row?.first_name)
      .filter((name) => name && name.trim() && name !== "Total");

    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSearch = () => {
    if (!filters.from || !filters.to) {
      setError("Please select both From and To dates before searching.");
      setRows([]);
      setHasSearched(false);
      return;
    }

    const nextFilters = {
      ...filters,
      username: searchValue,
    };

    setFilters(nextFilters);
    setHasSearched(true);
    loadOrders(nextFilters);
  };

  const handleDownload = () => {
    if (!visibleRows.length) {
      return;
    }

    exportTableToPdf({
      title: "Admin Order History",
      fileName: "admin-order-history.pdf",
      subtitle: `From: ${formatDateForApi(filters.from) || "-"}   To: ${
        formatDateForApi(filters.to) || "-"
      }   User Name: ${filters.username || "All"}`,
      headers: [
        "Order Number",
        "Order Date",
        "Name",
        "Order Status",
        "Payment Method",
        "Payment Status",
        "Amount",
      ],
      rows: visibleRows.map((row) => [
        row?.order_num ?? "",
        row?.order_date ?? "",
        row?.first_name ?? "",
        row?.status ?? "",
        row?.payment_method ?? "",
        row?.payment_status1 ?? "",
        formatCurrency(row?.subtotal),
      ]),
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f5f0_0%,#f4efe8_100%)] px-5 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="relative mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-2">
          <div className="pointer-events-none absolute left-[18%] top-0 hidden h-[420px] w-[380px] -translate-y-4 rounded-full bg-[radial-gradient(circle,rgba(188,173,149,0.16)_0%,rgba(188,173,149,0.07)_36%,transparent_72%)] lg:block" />

          <div className="relative z-10 flex flex-wrap items-center gap-4">
            <label className="flex h-[56px] w-[146px] items-center rounded-md bg-[#ebe6df] pl-2 pr-1">
              <span className="flex h-full flex-1 flex-col justify-center rounded-[3px] border border-[#857667] bg-white px-3 text-[#55493e]">
                <span className="text-[11px] leading-none text-[#6f655a]">From</span>
                <input
                  type="date"
                  name="from"
                  value={filters.from}
                  onChange={handleFilterChange}
                  className="mt-1 w-full bg-transparent text-[15px] outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </span>
              <CalendarDays size={15} className="mx-2 shrink-0 text-[#43372d]" />
            </label>

            <label className="flex h-[56px] w-[146px] items-center rounded-md bg-[#ebe6df] pl-2 pr-1">
              <span className="flex h-full flex-1 flex-col justify-center rounded-[3px] border border-[#857667] bg-white px-3 text-[#55493e]">
                <span className="text-[11px] leading-none text-[#6f655a]">To</span>
                <input
                  type="date"
                  name="to"
                  value={filters.to}
                  onChange={handleFilterChange}
                  className="mt-1 w-full bg-transparent text-[15px] outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </span>
              <CalendarDays size={15} className="mx-2 shrink-0 text-[#43372d]" />
            </label>

            <label className="flex h-[56px] w-[160px] items-center rounded-md bg-[#ebe6df] pl-2 pr-1">
              <span className="flex h-full flex-1 flex-col justify-center rounded-[3px] border border-[#857667] bg-white px-3 text-[#55493e]">
                <span className="text-[11px] leading-none text-[#6f655a]">User Name</span>
                <input
                  type="text"
                  list="admin-order-usernames"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder=""
                  className="mt-1 w-full bg-transparent text-[15px] outline-none"
                />
                <datalist id="admin-order-usernames">
                  {userOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </span>
              <ChevronDown size={15} className="mx-2 shrink-0 text-[#43372d]" />
            </label>

            <button
              type="button"
              onClick={handleSearch}
              className="inline-flex h-[40px] items-center gap-2 rounded-full bg-[#8b7d70] px-8 text-[15px] font-semibold text-white transition hover:bg-[#77685b]"
            >
              <Search size={18} />
              Search
            </button>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-[40px] items-center gap-2 rounded-full bg-[#8b7d70] px-8 text-[15px] font-semibold text-white transition hover:bg-[#77685b]"
            >
              Download
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-[40px] items-center gap-2 rounded-full bg-[#8b7d70] px-7 text-[15px] font-semibold text-white transition hover:bg-[#77685b]"
            >
              <ChevronsLeft size={16} />
              Back
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-[#dacfc1] bg-white/75 shadow-[0_12px_30px_rgba(120,99,74,0.05)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#e8ddd1] bg-transparent px-6 py-5">
            <div className="flex h-[42px] w-[56px] items-center justify-center gap-1 rounded-[8px] border border-[#8d7f70] bg-[#f8f5f1] text-[#4f4235]">
              <Search size={17} />
              <ChevronDown size={15} />
            </div>

            <input
              type="text"
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              placeholder=""
              className="h-[42px] min-w-[240px] flex-1 rounded-[4px] border border-[#9f9181] bg-white px-4 text-[#2d241d] outline-none"
            />

            <button
              type="button"
              onClick={() => setQuickSearch(quickSearch.trim())}
              className="px-3 text-[15px] font-semibold text-[#2f251d] transition hover:text-[#9d6d2f]"
            >
              Go
            </button>
          </div>

          <div className="relative overflow-x-auto">
            <div className="pointer-events-none absolute inset-y-0 left-[18%] hidden w-[38%] bg-[radial-gradient(circle,rgba(214,202,188,0.24)_0%,rgba(214,202,188,0.08)_42%,transparent_72%)] lg:block" />

            <table className="relative w-full min-w-[980px] border-collapse text-center">
              <thead className="bg-white/75 text-sm font-medium text-[#51473e]">
                <tr>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4 font-medium">
                    Order Number
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4 font-medium">
                    Order Date
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4 font-medium">
                    Name
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4 font-medium">
                    Order Status
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4 font-medium">
                    Payment Method
                  </th>
                  <th className="border-b border-r border-[#e7ddd2] px-4 py-4 font-medium">
                    Payment Status
                  </th>
                  <th className="border-b px-4 py-4 font-medium">Amount</th>
                </tr>
              </thead>

              <tbody className="text-[#231f1b]">
                {loading ? (
                  <tr>
                    <td className="px-4 py-10 text-center" colSpan="7">
                      Loading order history...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      className="px-4 py-10 text-center text-[#b04444]"
                      colSpan="7"
                    >
                      {error}
                    </td>
                  </tr>
                ) : !hasSearched ? (
                  <tr>
                    <td className="px-4 py-10 text-center" colSpan="7">
                      Select From and To dates, then click Search to view order history.
                    </td>
                  </tr>
                ) : visibleRows.length ? (
                  visibleRows.map((row, index) => {
                    const isTotalRow = row?.payment_status1 === "Total";

                    return (
                      <tr
                        key={`${row?.order_num ?? "total"}-${index}`}
                        className={`border-b border-[#eee4d9] ${
                          isTotalRow
                            ? "bg-[#f7f1e9] font-semibold"
                            : "bg-white/35 transition hover:bg-[#fcfaf7]"
                        }`}
                      >
                        <td className="border-r border-[#eee4d9] px-4 py-4 text-[#0b79c9]">
                          {row?.order_num || ""}
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          {row?.order_date || ""}
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          {isTotalRow ? "" : row?.first_name || "-"}
                        </td>
                        <td
                          className={`border-r border-[#eee4d9] px-4 py-4 ${
                            row?.status === "Completed"
                              ? "font-semibold text-[#0d9807]"
                              : ""
                          }`}
                        >
                          {row?.status || ""}
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          {row?.payment_method || ""}
                        </td>
                        <td className="border-r border-[#eee4d9] px-4 py-4">
                          {row?.payment_status1 || ""}
                        </td>
                        <td className="px-4 py-4">
                          {formatCurrency(row?.subtotal)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center" colSpan="7">
                      No orders found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
