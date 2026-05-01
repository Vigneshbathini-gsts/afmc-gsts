import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaChevronDown, FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, inventoryAPI } from "../../services/api";

const buildImageUrl = (fileName) => {
  const raw = String(fileName || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const baseUrl =
    API_BASE_URL || process.env.REACT_APP_API_URL || "http://localhost:5000/api";
  const cleanBase = baseUrl.replace(/\/api\/?$/, "");
  const normalizedName = raw.split(/[\\/]/).pop();
  const encodedName = encodeURIComponent(normalizedName);
  return `${cleanBase}/uploads/${encodedName}`;
};

export default function AttendantMenuDashboard() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);
  const itemDropdownRef = useRef(null);
  const searchRef = useRef("");

  const fetchCategories = useCallback(async () => {
    try {
      const response = await inventoryAPI.getCategories();
      setCategories(response.data.data || []);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, []);

  const fetchItems = useCallback(async (category) => {
    try {
      const response = await inventoryAPI.getItems(
        category ? { categoryId: category } : undefined
      );
      setItems(response.data.data || []);
    } catch (err) {
      console.error("Failed to load items:", err);
    }
  }, []);

  const fetchInventory = useCallback(
    async (options = {}) => {
      setLoading(true);
      setError("");

      try {
        const params = {
          categoryId: (options.categoryId ?? categoryId) || undefined,
          itemCode: (options.itemCode ?? itemCode) || undefined,
          q: (options.search ?? searchRef.current) || undefined,
        };

        const response = await inventoryAPI.getAll(params);
        const rows = response.data.data || [];
        const cleanedRows = rows.filter((row) => {
          if (row?.sub_category == null) return true;
          return ![14, 15].includes(Number(row.sub_category));
        });

        const groupedByItemCode = new Map();
        cleanedRows.forEach((row) => {
          const key = String(row?.item_code || row?.item_id || "").trim();
          if (!key) return;

          if (!groupedByItemCode.has(key)) {
            groupedByItemCode.set(key, { ...row });
            return;
          }

          const existing = groupedByItemCode.get(key);
          const existingQty = Number(existing?.stock_quantity || 0);
          const nextQty = Number(row?.stock_quantity || 0);

          groupedByItemCode.set(key, {
            ...existing,
            stock_quantity:
              (Number.isFinite(existingQty) ? existingQty : 0) +
              (Number.isFinite(nextQty) ? nextQty : 0),
            file_name: existing?.file_name || row?.file_name || "",
          });
        });

        setInventory(Array.from(groupedByItemCode.values()));
      } catch (err) {
        console.error("Failed to load inventory:", err);
        setError("Failed to load menu items.");
      } finally {
        setLoading(false);
      }
    },
    [categoryId, itemCode]
  );

  useEffect(() => {
    fetchCategories();
    fetchItems();
  }, [fetchCategories, fetchItems]);

  useEffect(() => {
    fetchItems(categoryId || "");
    setItemCode("");
    setItemFilter("");
    setIsItemDropdownOpen(false);
  }, [categoryId, fetchItems]);

  useEffect(() => {
    fetchInventory({ categoryId, itemCode, search });
  }, [fetchInventory, categoryId, itemCode, search]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target)
      ) {
        setIsCategoryDropdownOpen(false);
      }

      if (
        itemDropdownRef.current &&
        !itemDropdownRef.current.contains(event.target)
      ) {
        setIsItemDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCategories = useMemo(() => {
    const query = categoryFilter.trim().toLowerCase();
    if (!query) return categories;

    return categories.filter((category) =>
      String(category?.category_name || "")
        .toLowerCase()
        .includes(query)
    );
  }, [categories, categoryFilter]);

  const filteredItems = useMemo(() => {
    const query = itemFilter.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      String(item?.item_name || "")
        .toLowerCase()
        .includes(query)
    );
  }, [items, itemFilter]);

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) => String(category.category_id) === String(categoryId)
      ) || null,
    [categories, categoryId]
  );

  const selectedItem = useMemo(
    () =>
      items.find((item) => String(item.item_code) === String(itemCode)) || null,
    [items, itemCode]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl" />

      <div className="relative z-10 p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between md:mb-8">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Menu Dashboard
          </h1>
          <button
            type="button"
            onClick={() => navigate("/attendant/dashboard")}
            className="flex items-center gap-2 rounded-full border border-afmc-gold/30 bg-white px-5 py-2.5 text-gray-700 shadow transition hover:bg-afmc-maroon/5 hover:text-afmc-maroon hover:shadow-md"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <div className="rounded-3xl border border-afmc-gold/15 bg-white/80 p-5 shadow-xl backdrop-blur-sm md:p-6">
          <div className="mb-5 h-1 w-full rounded-full bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2 md:mb-6" />

          <div className="grid grid-cols-1 items-end gap-5 lg:grid-cols-3 md:gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Category Name
              </label>
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                >
                  <span className="truncate">
                    {selectedCategory?.category_name || "All Categories"}
                  </span>
                  <FaChevronDown
                    className={`text-gray-400 transition-transform ${
                      isCategoryDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                    <div className="border-b border-gray-100 p-3">
                      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <FaSearch className="text-gray-400" />
                        <input
                          type="text"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          placeholder="Search category name"
                          className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryId("");
                          setCategoryFilter("");
                          setIsCategoryDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${
                          !categoryId
                            ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
                            : "text-gray-700"
                        }`}
                      >
                        All Categories
                      </button>

                      {filteredCategories.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matching categories found.
                        </div>
                      ) : (
                        filteredCategories.map((category) => (
                          <button
                            key={category.category_id}
                            type="button"
                            onClick={() => {
                              setCategoryId(category.category_id);
                              setCategoryFilter(category.category_name || "");
                              setIsCategoryDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${
                              String(categoryId) === String(category.category_id)
                                ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
                                : "text-gray-700"
                            }`}
                          >
                            {category.category_name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Item Name
              </label>
              <div className="relative" ref={itemDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsItemDropdownOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                >
                  <span className="truncate">
                    {selectedItem?.item_name || "All Items"}
                  </span>
                  <FaChevronDown
                    className={`text-gray-400 transition-transform ${
                      isItemDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isItemDropdownOpen && (
                  <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                    <div className="border-b border-gray-100 p-3">
                      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <FaSearch className="text-gray-400" />
                        <input
                          type="text"
                          value={itemFilter}
                          onChange={(e) => setItemFilter(e.target.value)}
                          placeholder="Search item name"
                          className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                        />
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setItemCode("");
                          setItemFilter("");
                          setIsItemDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${
                          !itemCode
                            ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
                            : "text-gray-700"
                        }`}
                      >
                        All Items
                      </button>

                      {filteredItems.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matching items found.
                        </div>
                      ) : (
                        filteredItems.map((item) => (
                          <button
                            key={item.item_code}
                            type="button"
                            onClick={() => {
                              setItemCode(item.item_code);
                              setItemFilter(item.item_name || "");
                              setIsItemDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${
                              String(itemCode) === String(item.item_code)
                                ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
                                : "text-gray-700"
                            }`}
                          >
                            {item.item_name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="flex items-center gap-3">
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <FaSearch className="text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search item"
                    className="w-full bg-transparent text-gray-800 outline-none placeholder:text-gray-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextSearch = searchInput.trim();
                    setSearch(nextSearch);
                    fetchInventory({ search: nextSearch });
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-afmc-maroon px-5 py-3 font-semibold text-white shadow-afmc transition hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50"
                >
                  <FaSearch />
                  Search
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-8">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-afmc-gold/25 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-afmc-maroon/5 text-afmc-maroon">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Image</th>
                    <th className="px-4 py-3 text-left font-medium">Item Name</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">A/C Unit</th>
                    <th className="px-4 py-3 text-left font-medium">Stock</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                        Loading menu items...
                      </td>
                    </tr>
                  ) : inventory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-6 text-center text-gray-500">
                        No items found.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((row) => {
                      const imageUrl = buildImageUrl(row.file_name);
                      const stockValue = Number(row.stock_quantity || 0);
                      const isLowStock = Number.isFinite(stockValue) && stockValue <= 0;

                      return (
                        <tr
                          key={row.item_code || row.item_id}
                          className="border-t border-gray-100 transition-colors hover:bg-afmc-gold/10"
                        >
                          <td className="px-4 py-3">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={row.item_name}
                                className="h-12 w-12 rounded-xl object-cover ring-1 ring-afmc-gold/20"
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                                N/A
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {row.item_name}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {row.category_name || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{row.ac_unit || "-"}</td>
                          <td className="px-4 py-3 text-gray-700">{row.stock_quantity ?? 0}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                isLowStock
                                  ? "bg-red-100 text-red-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {isLowStock ? "Out of Stock" : "Available"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
