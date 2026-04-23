import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import api from "../../../services/api";
import Stackreporttab from "./Stackreporttab";
import { toInitCap } from "../../../utils/textFormat";

export default function BarstockReports() {
  const navigate = useNavigate();
  const rowsPerPage = 15;
  const requestInFlight = useRef(false);
  const [searchParams] = useSearchParams();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState(searchParams.get("itemName") || "");
  const [activeFilters, setActiveFilters] = useState({
    itemName: searchParams.get("itemName") || "",
    itemCode: searchParams.get("itemCode") || "",
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = useCallback(
    async ({ reset = false, nextPage = 0 } = {}) => {
      if (requestInFlight.current) {
        return;
      }

      try {
        requestInFlight.current = true;
        setLoading(true);

        const res = await api.get("/reports/stock-report", {
          params: {
            itemName: activeFilters.itemName.trim(),
            itemCode: activeFilters.itemCode.trim(),
            limit: rowsPerPage,
            offset: nextPage * rowsPerPage,
          },
        });

        const newData = res.data.data || [];

        if (reset) {
          setData(newData);
          setPage(1);
        } else {
          setData((prev) => [...prev, ...newData]);
          setPage(nextPage + 1);
        }

        setHasMore(newData.length === rowsPerPage);
      } catch (err) {
        console.error("Error fetching data:", err);
        if (reset) {
          setData([]);
        }
        setHasMore(false);
      } finally {
        requestInFlight.current = false;
        setLoading(false);
      }
    },
    [activeFilters]
  );

  useEffect(() => {
    const nextItemName = searchParams.get("itemName") || "";
    const nextItemCode = searchParams.get("itemCode") || "";

    setItemName(nextItemName);
    setActiveFilters({
      itemName: nextItemName,
      itemCode: nextItemCode,
    });
    setPage(0);
    setHasMore(true);
    setData([]);
  }, [searchParams]);

  useEffect(() => {
    fetchData({ reset: true, nextPage: 0 });
  }, [fetchData]);

  const handleSearch = () => {
    setPage(0);
    setHasMore(true);
    setData([]);
    setActiveFilters({
      itemName: itemName.trim(),
      itemCode: "",
    });
  };

  const handleScroll = (event) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;

    if (
      scrollTop + clientHeight >= scrollHeight - 80 &&
      !loading &&
      hasMore
    ) {
      fetchData({ nextPage: page });
    }
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
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name
              </label>
              <input
                type="text"
                placeholder="Search Item Name..."
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-72 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
              />
            </div>

            <button
              type="button"
              onClick={handleSearch}
              className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md"
            >
              Search
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div
              className="max-h-[70vh] overflow-auto"
              onScroll={handleScroll}
            >
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Item Code
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Item Name
                    </th>
                    {/* <th className="px-4 py-3 text-left font-medium">
                      Unit Price
                    </th> */}
                    <th className="px-4 py-3 text-left font-medium">
                      Total Price
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Available Stock
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      Reserved Stock
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      A/C Unit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.map((item, index) => (
                    <tr
                      key={`${item.item_code || "row"}-${index}`}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">{item.item_code}</td>
                      <td className="px-4 py-3 capitalize">
                        {toInitCap(item.item_name)}
                      </td>
                      {/* <td className="px-4 py-3">{item.unit_price ?? "-"}</td> */}
                      <td className="px-4 py-3">{item.total_price ?? "-"}</td>
                      <td className="px-4 py-3">{item.AVAILABLE_STOCK ?? 0}</td>
                      <td className="px-4 py-3">{item.RESERVED_STOCK ?? 0}</td>
                      <td className="px-4 py-3">
                        {toInitCap(item.A_C_UNIT ?? "-")}
                      </td>
                    </tr>
                  ))}

                  {!loading && !data.length && (
                    <tr>
                      <td className="px-4 py-6 text-center text-gray-500" colSpan="7">
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {loading && (
                <p className="px-4 py-6 text-center text-gray-500">
                  Loading...
                </p>
              )}
              {!loading && data.length > 0 && !hasMore && (
                <p className="px-4 py-6 text-center text-gray-500">
                  No more data
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
