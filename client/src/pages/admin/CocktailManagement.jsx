import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronsLeft,
  Pencil,
  PlusCircle,
  Search,
} from "lucide-react";
import api from "../../services/api";

export default function CocktailManagement() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async (searchValue = "") => {
    try {
      setLoading(true);
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
    <div className="min-h-screen bg-[#f7f4f1] px-8 py-6">
      <div className="mx-auto max-w-7xl rounded-2xl border border-[#e4dacf] bg-white/90 p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#d9cec1] bg-white px-4 py-3">
              <Search size={18} className="text-[#5b5148]" />
              <ChevronDown size={16} className="text-[#5b5148]" />
            </div>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cocktails..."
              className="w-56 rounded-xl border border-[#b9aa98] px-4 py-3 outline-none transition focus:border-[#7a6b5c]"
            />

            <button
              type="button"
              onClick={handleSearch}
              className="text-base font-semibold text-[#32281f]"
            >
              Go
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/cocktail-create")}
              className="flex items-center gap-2 rounded-full bg-[#6a9b1f] px-5 py-3 font-semibold text-white transition hover:bg-[#5b8719]"
            >
              <PlusCircle size={18} />
              Create
            </button>

            <button
              type="button"
              onClick={() => navigate("/admin/dashboard")}
              className="flex items-center gap-2 rounded-full bg-[#7d7064] px-5 py-3 font-semibold text-white transition hover:bg-[#6b6055]"
            >
              <ChevronsLeft size={18} />
              Go To Dashboard
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e5ddd4]">
          <table className="w-full border-collapse text-center">
            <thead className="bg-[#faf8f6] text-sm text-[#5d544b]">
              <tr>
                <th className="border-b border-r border-[#e5ddd4] px-4 py-4">
                  View
                </th>
                
                <th className="border-b border-r border-[#e5ddd4] px-4 py-4">
                  Item Name
                </th>
                <th className="border-b px-4 py-4">Category</th>
              </tr>
            </thead>

            <tbody className="bg-white text-[#1f1f1f]">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center" colSpan="4">
                    Loading...
                  </td>
                </tr>
              ) : items.length ? (
                items.map((item) => (
                  <tr key={item.ITEM_ID} className="border-b border-[#ece3da]">
                    <td className="border-r border-[#ece3da] px-4 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/admin/cocktail-edit?itemId=${item.ITEM_ID}`)
                        }
                        className="inline-flex text-[#0a7cc5] transition hover:text-[#075d92]"
                        aria-label={`View ${item.ITEM_NAME}`}
                      >
                        <Pencil size={18} />
                      </button>
                    </td>
                   
                    <td className="border-r border-[#ece3da] px-4 py-4">
                      {item.ITEM_NAME}
                    </td>
                    <td className="px-4 py-4">{item.CATEGORY_NAME}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center" colSpan="4">
                    No cocktail or mocktail items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
