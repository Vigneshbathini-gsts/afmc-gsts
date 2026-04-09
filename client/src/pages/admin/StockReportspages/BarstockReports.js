import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import Stackreporttab from "./Stackreporttab";

export default function BarstockReports() {
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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-[#d70652]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#ff025e]/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 p-6">
        <Stackreporttab />

        <div className="mt-6 flex gap-4">
          <input
            type="text"
            placeholder="Search Item Name..."
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-64 rounded-lg border px-4 py-2"
          />

          <button
            onClick={handleSearch}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white"
          >
            Search
          </button>
        </div>

        <div
          className="mt-6 max-h-[70vh] overflow-auto rounded-xl bg-white shadow"
          onScroll={handleScroll}
        >
<<<<<<< HEAD
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-100 text-xs uppercase">
=======
          Search
        </button>
      </div>

      {activeFilters.itemCode && (
        <p className="mt-3 text-sm text-gray-600">
          Showing stock report for item: <span className="font-semibold">{activeFilters.itemName || activeFilters.itemCode}</span>
        </p>
      )}

      <div
        className="mt-6 max-h-[70vh] overflow-auto rounded-xl bg-white shadow"
        onScroll={handleScroll}
      >
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-gray-100 text-xs uppercase">
            <tr>
              <th className="p-3">Item Code</th>
              <th className="p-3">Item Name</th>
              <th className="p-3">Unit Price</th>
              <th className="p-3">Total Price</th>
              <th className="p-3">Available Stock</th>
              <th className="p-3">Reserved Stock</th>
              <th className="p-3">A/C Unit</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item, index) => (
              <tr
                key={`${item.item_code || "row"}-${index}`}
                className="border-b hover:bg-gray-50"
              >
                <td className="p-3">{item.item_code}</td>
                <td className="p-3">{item.item_name}</td>
                <td className="p-3">{item.unit_price ?? "-"}</td>
                <td className="p-3">{item.total_price ?? "-"}</td>
                <td className="p-3">{item.AVAILABLE_STOCK ?? 0}</td>
                <td className="p-3">{item.RESERVED_STOCK ?? 0}</td>
                <td className="p-3">{item.A_C_UNIT ?? "-"}</td>
              </tr>
            ))}

            {!loading && !data.length && (
>>>>>>> 55d10ea2d20a23f6c0c06d524019f36849c4781e
              <tr>
                <th className="p-3">Item Code</th>
                <th className="p-3">Item Name</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3">Total Price</th>
                <th className="p-3">Available Stock</th>
                <th className="p-3">Reserved Stock</th>
                <th className="p-3">A/C Unit</th>
              </tr>
            </thead>

            <tbody>
              {data.map((item, index) => (
                <tr
                  key={`${item.item_code || "row"}-${index}`}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="p-3">{item.item_code}</td>
                  <td className="p-3">{item.item_name}</td>
                  <td className="p-3">{item.unit_price || "-"}</td>
                  <td className="p-3">{item.total_price || "-"}</td>
                  <td className="p-3">{item.AVAILABLE_STOCK || 0}</td>
                  <td className="p-3">{item.RESERVED_STOCK || 0}</td>
                  <td className="p-3">{item.A_C_UNIT || "-"}</td>
                </tr>
              ))}

              {!loading && !data.length && (
                <tr>
                  <td className="p-3 text-center" colSpan="7">
                    No data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {loading && <p className="p-3 text-center">Loading...</p>}
          {!loading && data.length > 0 && !hasMore && (
            <p className="p-3 text-center">No more data</p>
          )}
        </div>
      </div>
    </div>
  );
}
