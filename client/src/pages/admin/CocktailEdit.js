import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Save, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cocktailAPI } from "../../services/api";
import { toInitCap } from "../../utils/textFormat";
import { FaArrowLeft } from "react-icons/fa";
import FilterDropdown from "../../components/common/FilterDropdown";

const createEmptyRow = () => ({
  id: Date.now() + Math.floor(Math.random() * 1000),
  itemCode: "",
  itemName: "",
  pegs: "",
  memberPrice: "",
  nonMemberPrice: "",
});

const normalizeItemCode = (value) => String(value ?? "").trim();
const INGREDIENT_PAGE_SIZE = 20;

const getDetailValue = (row, ...keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) {
      return row[key];
    }
  }
  return "";
};

export default function CocktailEdit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get("itemId");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [ingredientPage, setIngredientPage] = useState(0);
  const [ingredientHasMore, setIngredientHasMore] = useState(true);
  const [ingredientsLoadingMore, setIngredientsLoadingMore] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const ingredientRequestIdRef = useRef(0);
  const [form, setForm] = useState({
    itemName: "",
    subCategory: "",
    description: "",
    // memberProfit: "",
    memberPrCharges: "",
    // nonMemberProfit: "",
    nonMemberPrCharges: "",
    image: null,
    imageFileName: "",
  });
  const [rows, setRows] = useState([createEmptyRow()]);

  // Fetches a single page of ingredient options, filtered by `query` on the
  // backend (real search: matches ITEM_NAME or ITEM_CODE server-side).
  const fetchIngredientOptions = useCallback(async ({ reset = true, nextPage = 0, query = "", subCategory = "" } = {}) => {
      const requestId = ++ingredientRequestIdRef.current;
      if (!reset) setIngredientsLoadingMore(true);
      else setIngredientsLoading(true);
      try {
        const response = await cocktailAPI.getIngredientOptions(query, {
          limit: INGREDIENT_PAGE_SIZE,
          offset: nextPage * INGREDIENT_PAGE_SIZE,
          subCategory,
        });

        // Ignore this result if a newer search/page request has since started
        // (prevents an older, slower response from overwriting fresher results).
        if (requestId !== ingredientRequestIdRef.current) return;

        const rows = response.data?.data || [];
        setIngredientOptions((current) => (reset ? rows : [...current, ...rows]));
        setIngredientPage(nextPage + 1);
        setIngredientHasMore(rows.length === INGREDIENT_PAGE_SIZE);
      } catch (fetchError) {
        if (requestId !== ingredientRequestIdRef.current) return;
        console.error(fetchError);
        setIngredientHasMore(false);
      } finally {
        if (requestId === ingredientRequestIdRef.current) {
          setIngredientsLoadingMore(false);
          setIngredientsLoading(false);
        }
      }
    }, []);

  // Initial load: first page, no search term.
  useEffect(() => {
    fetchIngredientOptions({ reset: true, nextPage: 0, query: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce what the user types in the dropdown's own search box, then ask
  // the backend for matching items directly — no scrolling needed to find them.
  useEffect(() => {
    const handle = setTimeout(() => {
      fetchIngredientOptions({ reset: true, nextPage: 0, query: ingredientSearch, subCategory: form.subCategory });
    }, 300);
    return () => clearTimeout(handle);
  }, [ingredientSearch, form.subCategory, fetchIngredientOptions]);

  const handleIngredientSearchChange = useCallback((nextQuery) => {
    setIngredientSearch(nextQuery);
    setIngredientsLoading(true);
  }, []);

  const handleIngredientMenuScroll = useCallback(() => {
    fetchIngredientOptions({ reset: false, nextPage: ingredientPage, query: ingredientSearch, subCategory: form.subCategory });
  }, [fetchIngredientOptions, ingredientPage, ingredientSearch, form.subCategory]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateRow = (id, field, value) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const getOptionByItemCode = (itemCode) =>
    ingredientOptions.find(
      (option) => String(option.ITEM_CODE) === String(itemCode)
    );

  const recalculateRowPrices = async (rowId, itemCode, pegs) => {
    const numericPegs = Number(pegs);

    if (!itemCode || !pegs || Number.isNaN(numericPegs) || numericPegs <= 0) {
      setRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? { ...row, memberPrice: "", nonMemberPrice: "" }
            : row
        )
      );
      return;
    }

    try {
      const response = await cocktailAPI.getIngredientPrice(itemCode, pegs);
      const pricing = response.data?.data;

      setRows((current) =>
        current.map((row) =>
          row.id === rowId
            ? {
                ...row,
                itemName: pricing?.itemName || row.itemName,
                memberPrice:
                  pricing?.memberPrice != null ? String(pricing.memberPrice) : "",
                nonMemberPrice:
                  pricing?.nonMemberPrice != null
                    ? String(pricing.nonMemberPrice)
                    : "",
              }
            : row
        )
      );
    } catch (pricingError) {
      console.error(pricingError);
      const pricingErrorMessage =
        pricingError.response?.data?.message ||
        "Unable to calculate member/non-member price for the selected item.";
      setError(pricingErrorMessage);
      toast.error(pricingErrorMessage);
    }
  };

  const handleItemCodeChange = async (rowId, itemCode) => {
    const normalizedItemCode = normalizeItemCode(itemCode);
    const alreadySelected = rows.some(
      (row) =>
        row.id !== rowId &&
        normalizeItemCode(row.itemCode) === normalizedItemCode
    );

    if (normalizedItemCode && alreadySelected) {
      const duplicateMessage = "This ingredient is already selected for this item.";
      setError(duplicateMessage);
      toast.error(duplicateMessage);
      return;
    }

    const option = getOptionByItemCode(itemCode);
    const selectedName = option?.ITEM_NAME || "";
    const existingRow = rows.find((row) => row.id === rowId);
    setError("");

    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              itemCode,
              itemName: toInitCap(selectedName),
              memberPrice: "",
              nonMemberPrice: "",
            }
          : row
      )
    );

    if (existingRow?.pegs) {
      await recalculateRowPrices(rowId, itemCode, existingRow.pegs);
    }
  };

  // const handlePegsChange = async (rowId, pegs) => {
  //   const existingRow = rows.find((row) => row.id === rowId);
  //   updateRow(rowId, "pegs", pegs);

  //   if (existingRow?.itemCode) {
  //     await recalculateRowPrices(rowId, existingRow.itemCode, pegs);
  //   }
  // };


  const handlePegsChange = async (rowId, pegs) => {
  // Remove everything except digits and decimal point
  let cleanedValue = pegs.replace(/[^0-9.]/g, "");

  // Prevent dot as first character
  if (cleanedValue.startsWith(".")) {
    cleanedValue = cleanedValue.substring(1);
  }

  // Allow only one decimal point
  const parts = cleanedValue.split(".");
  if (parts.length > 2) {
    cleanedValue = `${parts[0]}.${parts.slice(1).join("")}`;
  }

  const existingRow = rows.find((row) => row.id === rowId);

  updateRow(rowId, "pegs", cleanedValue);

  if (existingRow?.itemCode && cleanedValue) {
    await recalculateRowPrices(
      rowId,
      existingRow.itemCode,
      cleanedValue
    );
  }
};

  const addRow = () => {
    setRows((current) => [...current, createEmptyRow()]);
  };

  const deleteRow = (id) => {
    setRows((current) => {
      if (current.length === 1) return current;
      toast.success("Ingredient row removed.");
      return current.filter((row) => row.id !== id);
    });
  };

  useEffect(() => {
    const fetchCocktail = async () => {
      if (!itemId) {
        setError("Item id is missing.");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await cocktailAPI.getById(itemId);
        const item = response.data.data;
        const detailRows = Array.isArray(item.details) ? item.details : [];
        setForm({
          itemName: item.ITEM_NAME || "",
          subCategory: item.SUB_CATEGORY != null ? String(item.SUB_CATEGORY) : "",
          description: item.DESCRIPTION || "",
          // memberProfit: item.PROFIT != null ? String(item.PROFIT) : "",
          memberPrCharges:
            item.FOOD_PR_CHARGES != null ? String(item.FOOD_PR_CHARGES) : "",
          // nonMemberProfit:
          //   item.NON_MEMBER_PROFIT != null
          //     ? String(item.NON_MEMBER_PROFIT)
          //     : "",
          nonMemberPrCharges:
            item.PR_CHARGES != null ? String(item.PR_CHARGES) : "",
          image: null,
          imageFileName: item.FILE_NAME || "",
        });

        setRows(
          detailRows.length
            ? detailRows.map((row, index) => ({
                id: getDetailValue(row, "MOC_ID", "mocId") || Date.now() + index,
                itemCode: String(getDetailValue(row, "ITEM_CODE", "itemCode")),
                itemName: getDetailValue(row, "ITEM_NAME", "itemName"),
                pegs: String(getDetailValue(row, "PEGS", "pegs")),
                memberPrice: String(getDetailValue(row, "PRICE", "price", "memberPrice")),
                nonMemberPrice: String(
                  getDetailValue(
                    row,
                    "NON_MEMBER_PRICE",
                    "non_member_price",
                    "nonMemberPrice"
                  )
                ),
              }))
            : [createEmptyRow()]
        );
      } catch (fetchError) {
        console.error(fetchError);
        setError(
          fetchError.response?.data?.message || "Unable to load cocktail item."
        );
        setRows([createEmptyRow()]);
      } finally {
        setLoading(false);
      }
    };

    fetchCocktail();
  }, [itemId]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const haystack = `${row.itemCode} ${row.itemName} ${row.pegs} ${row.memberPrice} ${row.nonMemberPrice}`;
      return haystack.toLowerCase().includes(search.toLowerCase());
    });
  }, [rows, search]);

  const selectedIngredientCodes = useMemo(() => {
    return new Set(
      rows
        .map((row) => normalizeItemCode(row.itemCode))
        .filter(Boolean)
    );
  }, [rows]);

  const getIngredientDropdownOptions = (currentRow) => {
    const currentItemCode = normalizeItemCode(currentRow?.itemCode);
    const options = ingredientOptions
      .filter((opt) => {
        const optionItemCode = normalizeItemCode(opt.ITEM_CODE);
        return (
          optionItemCode &&
          (!selectedIngredientCodes.has(optionItemCode) ||
            optionItemCode === currentItemCode)
        );
      })
      .map((opt) => {
        const itemCode = normalizeItemCode(opt.ITEM_CODE);
        return {
          value: itemCode,
          label: `${itemCode} - ${toInitCap(opt.ITEM_NAME)}`,
        };
      });

    if (
      currentItemCode &&
      currentRow?.itemName &&
      !options.some((option) => String(option.value) === currentItemCode)
    ) {
      return [
        {
          value: currentItemCode,
          label: `${currentItemCode} - ${toInitCap(currentRow.itemName)}`,
        },
        ...options,
      ];
    }

    return options;
  };

  const formatIngredientLabel = (label) => {
    const str = String(label ?? "");
    const parts = str.split("-");
    if (parts.length < 2) return str;
    const code = parts[0]?.trim() ?? "";
    const name = parts.slice(1).join("-").trim();
    return `${code} - ${toInitCap(name)}`;
  };

  const handleSubmit = async () => {
    if (!itemId) {
      const missingIdMessage = "Item id is missing.";
      setError(missingIdMessage);
      toast.error(missingIdMessage);
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (!form.itemName?.trim()) {
        const validationMessage = "Item name is required.";
        setError(validationMessage);
        toast.error(validationMessage);
        return;
      }

      if (!form.subCategory) {
        const validationMessage = "Please select Cocktail or Mocktail.";
        setError(validationMessage);
        toast.error(validationMessage);
        return;
      }

      const normalizedRows = rows
        .map((row) => ({
          ...row,
          itemCode: String(row.itemCode ?? "").trim(),
          pegs: String(row.pegs ?? "").trim(),
        }))
        .filter((row) => row.itemCode && Number(row.pegs) > 0);

      const payload = new FormData();
      payload.append("itemName", form.itemName.trim());
      payload.append("subCategory", form.subCategory);
      payload.append("description", form.description);
      // payload.append("memberProfit", form.memberProfit);
      payload.append("memberPrCharges", form.memberPrCharges);
      // payload.append("nonMemberProfit", form.nonMemberProfit);
      payload.append("nonMemberPrCharges", form.nonMemberPrCharges);
      payload.append("rows", JSON.stringify(normalizedRows));

      if (form.image) {
        payload.append("image", form.image);
      }

      await cocktailAPI.update(itemId, payload);
      const successMessage = "Cocktail item updated successfully.";
      toast.success(successMessage);
      navigate("/admin/cocktail-management");
    } catch (submitError) {
      console.error(submitError);
      const message =
        submitError.response?.data?.message ||
        "Unable to update cocktail item. Please review the entered values.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="px-0 py-4 md:p-8 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Edit Cocktail/Mocktail
          </h1>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/cocktail-management")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-afmc-gold/30 text-gray-700 hover:text-afmc-maroon hover:bg-afmc-maroon/5 transition"
            >
              <FaArrowLeft />
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold shadow hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="bg-white/80 border border-afmc-gold/15 rounded-3xl shadow-xl backdrop-blur-sm p-5 md:p-6">
          <div className="mb-5 md:mb-6 h-1 w-full rounded-full bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2" />

          <div className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 items-start">
            <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Item Name</label>
              <input
                value={form.itemName}
                onChange={(event) => updateField("itemName", event.target.value)}
                placeholder="Item Name"
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 capitalize"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Sub Category</label>
              <select
                value={form.subCategory}
                onChange={(event) => updateField("subCategory", event.target.value)}
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
              >
                <option value="">Sub Category</option>
                <option value="14">MOCKTAIL</option>
                <option value="15">COCKTAIL</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Description</label>
              <input
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Description"
                className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  updateField("image", file);
                  updateField("imageFileName", file?.name || form.imageFileName);
                }}
                className="h-[52px] w-full rounded-2xl border border-dashed border-gray-300 bg-white px-4 flex items-center file:mr-3 file:h-full file:border-0 file:bg-transparent"
              />
              {form.imageFileName && (
                <p className="mt-2 text-sm text-[#6d655e]">{form.imageFileName}</p>
              )}
            </div>

           
          </div>

          {/* Pr Charges inputs - side by side on mobile too, 4 cols on xl */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
             <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Member PR charges</label>
            <input
              type="number"
              min={0}
              value={form.memberPrCharges}
              onChange={(event) =>
                updateField("memberPrCharges", event.target.value)
              }
              placeholder="Member PR Charges"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 sm:px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
            />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Non Member PR charges</label>
            <input
               type="number"
                min={0}
              value={form.nonMemberPrCharges}
              onChange={(event) =>
                updateField("nonMemberPrCharges", event.target.value)
              }
              placeholder="Non Member PR Charges"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 sm:px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
            />
              </div>

          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {/* Ingredients header - label stacks above on mobile, Search + Add Row always side by side */}
            <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Search size={18} />
                <span className="text-sm font-medium">Ingredients</span>
              </div>

              <div className="flex items-center gap-2 sm:ml-auto sm:gap-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search: All Text Columns"
                  className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 sm:flex-none"
                />
                <button
                  type="button"
                  onClick={addRow}
                  className="shrink-0 whitespace-nowrap rounded-2xl bg-[#5b5b5b] px-4 py-3 font-semibold text-white shadow hover:shadow-md sm:px-6"
                >
                  Add Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-center text-sm">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[22%]" />
                  <col className="w-[24%]" />
                  <col className="w-20" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-24" />
                </colgroup>
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="border-b border-r border-gray-100 px-4 py-4">
                      #
                    </th>
                    <th className="border-b border-r border-gray-100 px-4 py-4">
                      Item Code
                    </th>
                    <th className="border-b border-r border-gray-100 px-4 py-4">
                      Item Name
                    </th>
                    <th className="border-b border-r border-gray-100 px-4 py-4">
                      Pegs
                    </th>
                    <th className="border-b border-r border-gray-100 px-4 py-4">
                      Member Price
                    </th>
                    <th className="border-b border-r border-gray-100 px-4 py-4">
                      Non Member Price
                    </th>
                    <th className="border-b px-4 py-4">Delete Row</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-gray-500" colSpan="7">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredRows.length ? (
                    filteredRows.map((row, index) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="border-r border-gray-100 px-4 py-6">
                          {index + 1}
                        </td>
                        <td className="border-r border-gray-100 px-2 py-3">
                          <FilterDropdown
                            value={row.itemCode}
                            onChange={(next) => handleItemCodeChange(row.id, next)}
                            options={getIngredientDropdownOptions(row)}
                            placeholder="Select Item"
                            allLabel="Clear"
                            formatLabel={formatIngredientLabel}
                            buttonClassName="rounded-xl px-3 py-2 bg-transparent text-center"
                            valueClassName="normal-case"
                            menuClassName="text-left"
                            usePortal
                            menuWidth={250}
                            searchValue={ingredientSearch}
                            onMenuScroll={handleIngredientMenuScroll}
                            onSearchChange={handleIngredientSearchChange}
                            hasMore={ingredientHasMore}
                            loadingMore={ingredientsLoadingMore}
                            loading={ingredientsLoading}
                            loadingLabel="Searching..."
                          />
                        </td>
                        <td className="border-r border-gray-100 px-2 py-3">
                          <input
                            value={toInitCap(row.itemName)}
                            readOnly
                            className="w-full bg-transparent text-center outline-none capitalize"
                          />
                        </td>
                        <td className="border-r border-gray-100 px-2 py-3">
                          <input
                            value={row.pegs}
                            onChange={(event) =>
                              handlePegsChange(row.id, event.target.value)
                            }
                            className="w-full bg-transparent text-center outline-none"
                          />
                        </td>
                        <td className="border-r border-gray-100 px-2 py-3">
                          <input
                            value={row.memberPrice}
                            readOnly
                            className="w-full bg-transparent text-center outline-none"
                          />
                        </td>
                        <td className="border-r border-gray-100 px-2 py-3">
                          <input
                            value={row.nonMemberPrice}
                            readOnly
                            className="w-full bg-transparent text-center outline-none"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() => deleteRow(row.id)}
                            className="font-semibold text-afmc-maroon hover:text-afmc-maroon2"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-10 text-center text-gray-500" colSpan="7">
                        No data found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600">
              <span>Showing {filteredRows.length} rows</span>
              <span>Total {rows.length}</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}