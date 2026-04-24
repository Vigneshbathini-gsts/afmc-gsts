import React, { useEffect, useMemo, useState } from "react";
import { PlusCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export default function CocktailCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    itemName: "",
    subCategory: "",
    description: "",
    memberProfit: "",
    memberPrCharges: "",
    nonMemberProfit: "",
    nonMemberPrCharges: "",
    image: null,
  });
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([createEmptyRow()]);
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const validateForm = () => {
    const trimmedItemName = form.itemName.trim();

    if (!trimmedItemName) {
      return "Item name is required.";
    }

    if (!form.subCategory) {
      return "Sub category is required.";
    }

    if (form.memberProfit === "") {
      return "Member Profit is required.";
    }

    if (form.memberPrCharges === "") {
      return "Member Pr Charges is required.";
    }

    if (form.nonMemberProfit === "") {
      return "Non Member Profit is required.";
    }

    if (form.nonMemberPrCharges === "") {
      return "Non Member Pr Charges is required.";
    }

    return "";
  };

  useEffect(() => {
    const fetchIngredientOptions = async () => {
      try {
        const response = await cocktailAPI.getIngredientOptions();
        setIngredientOptions(response.data?.data || []);
        console.log(response.data);
      } catch (fetchError) {
        console.error(fetchError);
      }
    };

    fetchIngredientOptions();
  }, []);

  const updateForm = (field, value) => {
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
      console.log("response",response.data);

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
      setError(
        pricingError.response?.data?.message ||
          "Unable to calculate member/non-member price for the selected item."
      );
    }
  };

  const handleItemCodeChange = async (rowId, itemCode) => {
    const option = getOptionByItemCode(itemCode);
    const selectedName = option?.ITEM_NAME || "";
    const existingRow = rows.find((row) => row.id === rowId);

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

  const handlePegsChange = async (rowId, pegs) => {
    const existingRow = rows.find((row) => row.id === rowId);
    updateRow(rowId, "pegs", pegs);

    if (existingRow?.itemCode) {
      await recalculateRowPrices(rowId, existingRow.itemCode, pegs);
    }
  };

  const addRow = () => {
    setRows((current) => [...current, createEmptyRow()]);
  };

  const deleteRow = (id) => {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id)
    );
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const haystack = `${row.itemCode} ${row.itemName} ${row.pegs} ${row.memberPrice} ${row.nonMemberPrice}`;
      return haystack.toLowerCase().includes(search.toLowerCase());
    });
  }, [rows, search]);

  const subCategoryOptions = useMemo(
    () => [
      { value: "14", label: "Cocktail" },
      { value: "15", label: "Mocktail" },
    ],
    []
  );

  const ingredientDropdownOptions = useMemo(() => {
    return ingredientOptions.map((opt) => ({
      value: String(opt.ITEM_CODE ?? "").trim(),
      label: `${String(opt.ITEM_CODE ?? "").trim()} - ${toInitCap(opt.ITEM_NAME)}`,
    }));
  }, [ingredientOptions]);

  const formatIngredientLabel = (label) => {
    const str = String(label ?? "");
    const parts = str.split("-");
    if (parts.length < 2) return str;
    const code = parts[0]?.trim() ?? "";
    const name = parts.slice(1).join("-").trim();
    return `${code} - ${toInitCap(name)}`;
  };

  const handleSubmit = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setError(validationMessage);
      window.alert(validationMessage);
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (!form.itemName?.trim()) {
        setError("Item name is required.");
        return;
      }

      if (!form.subCategory) {
        setError("Please select Cocktail or Mocktail.");
        return;
      }

      const normalizedRows = rows
        .map((row) => ({
          ...row,
          itemCode: String(row.itemCode ?? "").trim(),
          pegs: String(row.pegs ?? "").trim(),
        }))
        .filter((row) => row.itemCode && Number(row.pegs) > 0);

      if (!normalizedRows.length) {
        setError("Please add at least one ingredient with a valid peg value.");
        return;
      }

      const payload = new FormData();
      payload.append("itemName", form.itemName.trim());
      payload.append("subCategory", form.subCategory);
      payload.append("description", form.description);
      payload.append("memberProfit", form.memberProfit);
      payload.append("memberPrCharges", form.memberPrCharges);
      payload.append("nonMemberProfit", form.nonMemberProfit);
      payload.append("nonMemberPrCharges", form.nonMemberPrCharges);
      payload.append("rows", JSON.stringify(normalizedRows));

      if (form.image) {
        payload.append("image", form.image);
      }

      const response = await cocktailAPI.create(payload);
      const createdItemId = response.data?.data?.itemId;

      if (createdItemId) {
        navigate("/admin/cocktail-management");
        return;
      }
      navigate("/admin/cocktail-management");
    } catch (submitError) {
      console.error(submitError);
      const message =
        submitError.response?.data?.message ||
        "Unable to create cocktail item. Please check the entered values.";
      setError(message);
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="p-6 md:p-8 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Create Cocktail/Mocktail
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
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-afmc-maroon hover:bg-afmc-maroon2 text-white font-semibold shadow hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PlusCircle size={18} />
              {saving ? "Creating..." : "Create"}
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <input
              value={form.itemName}
              onChange={(event) => {
                updateForm("itemName", event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Item Name"
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 capitalize"
            />
            <FilterDropdown
              label="Sub Category"
              value={form.subCategory}
              onChange={(next) => updateForm("subCategory", next)}
              options={subCategoryOptions}
              placeholder="Sub Category"
              allLabel="All"
            />
            <input
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder="Description"
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
            />
            <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  updateForm("image", event.target.files?.[0] || null)
                }
                className="w-full rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={form.memberProfit}
              onChange={(event) => {
                updateForm("memberProfit", event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Member Profit"
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
            />
            <input
              value={form.memberPrCharges}
              onChange={(event) => {
                updateForm("memberPrCharges", event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Member Pr Charges"
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
            />
            <input
              value={form.nonMemberProfit}
              onChange={(event) => {
                updateForm("nonMemberProfit", event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Non Member Profit"
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
            />
            <input
              value={form.nonMemberPrCharges}
              onChange={(event) => {
                updateForm("nonMemberPrCharges", event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Non Member Pr Charges"
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 px-4 py-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Search size={18} />
                <span className="text-sm font-medium">Ingredients</span>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search: All Text Columns"
                className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
              />
              <button
                type="button"
                onClick={addRow}
                className="ml-auto px-6 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold shadow hover:shadow-md"
              >
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-sm">
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
                  {filteredRows.map((row, index) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="border-r border-gray-100 px-2 py-3">
                        {index + 1}
                      </td>
                      <td className="border-r border-gray-100 px-2 py-3">
                        <FilterDropdown
                          value={row.itemCode}
                          onChange={(next) => handleItemCodeChange(row.id, next)}
                          options={ingredientDropdownOptions}
                          placeholder="Select Item"
                          allLabel="Clear"
                          formatLabel={formatIngredientLabel}
                          buttonClassName="rounded-xl px-3 py-2 bg-transparent text-center"
                          valueClassName="normal-case"
                          menuClassName="text-left"
                          usePortal
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
                  ))}
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
