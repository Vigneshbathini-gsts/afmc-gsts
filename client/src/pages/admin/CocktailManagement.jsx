import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronsLeft,
  Pencil,
  PlusCircle,
  Search,
} from "lucide-react";
import api from "../../services/api";
import { toInitCap } from "../../utils/textFormat";

export default function CocktailManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchItems = useCallback(async (searchValue = "") => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/cocktails", {
        params: {
          search: searchValue.trim(),
        },
      });

      if (response.data.success) {
        setItems(response.data.data || []);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error("Cocktail fetch failed:", error);
      setError("Failed to load cocktail items.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSearch = () => {
    fetchItems(search);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="p-8 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">
            Cocktail Management
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-white/60 text-gray-700"
          >
            <ChevronsLeft size={18} />
            Go To Dashboard
          </button>
        </div>

        <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-6">
          <div className="flex flex-wrap items-end gap-4 mb-6">
            <div className="min-w-[260px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <Search size={18} className="text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search cocktails..."
                    className="w-full bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSearch();
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSearch}
                  className="px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md"
                >
                  <Search size={18} />
                  Search
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/cocktail-create")}
              className="ml-auto px-6 py-3 rounded-2xl bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold flex items-center gap-2 shadow hover:shadow-md transition"
            >
              <PlusCircle size={18} />
              Create
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Edit</th>
                  <th className="px-4 py-3 text-left font-medium">Item Name</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan="3">
                      Loading...
                    </td>
                  </tr>
                ) : items.length ? (
                  items.map((item) => (
                    <tr
                      key={item.ITEM_ID}
                      className="border-t border-gray-100 hover:bg-afmc-gold/10 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/admin/cocktail-edit?itemId=${item.ITEM_ID}`)
                          }
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-afmc-maroon hover:bg-afmc-maroon/10"
                          aria-label={`Edit ${item.ITEM_NAME}`}
                        >
                          <Pencil size={18} />
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 capitalize">
                        {toInitCap(item.ITEM_NAME)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 capitalize">
                        {toInitCap(item.CATEGORY_NAME)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan="3">
                      No cocktail or mocktail items found.
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
