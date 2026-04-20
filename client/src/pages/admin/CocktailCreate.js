import React, { useEffect, useMemo, useState } from "react";
import { ChevronsLeft, PlusCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cocktailAPI } from "../../services/api";

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
    if (!itemCode || !pegs) {
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
              itemName: selectedName,
              memberPrice: itemCode ? row.memberPrice : "",
              nonMemberPrice: itemCode ? row.nonMemberPrice : "",
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

      const payload = new FormData();
      console.log("payload",payload)
      payload.append("itemName", form.itemName);
      payload.append("subCategory", form.subCategory);
      payload.append("description", form.description);
      payload.append("memberProfit", form.memberProfit);
      payload.append("memberPrCharges", form.memberPrCharges);
      payload.append("nonMemberProfit", form.nonMemberProfit);
      payload.append("nonMemberPrCharges", form.nonMemberPrCharges);
      payload.append("rows", JSON.stringify(rows));

      if (form.image) {
        payload.append("image", form.image);
      }

      const response = await cocktailAPI.create(payload);
      const createdItemId = response.data?.data?.itemId;

      if (createdItemId) {
        navigate(`/admin/cocktail-edit?itemId=${createdItemId}`);
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
    <div className="min-h-screen bg-[#f7f4f1] px-8 py-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#e1d6ca] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#eee4d8] px-6 py-5">
          <h1 className="text-3xl font-semibold text-[#1f1d1b]">
            Mocktails/Cocktails
          </h1>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/cocktail-management")}
              className="flex items-center gap-2 rounded-full bg-[#7a7067] px-5 py-3 font-semibold text-white"
            >
              <ChevronsLeft size={18} />
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-[#5d941a] px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              <PlusCircle size={18} />
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
              required
              className="rounded-md border border-[#a79e96] px-4 py-4 outline-none"
            />
            <select
              value={form.subCategory}
              onChange={(event) => {
                updateForm("subCategory", event.target.value);
                if (error) {
                  setError("");
                }
              }}
              required
              className="rounded-md border border-[#a79e96] px-4 py-4 outline-none"
            >
              <option value="">Sub Category</option>
              <option value="14">COCKTAIL</option>
              <option value="15">MOCKTAIL</option>
            </select>
            <input
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder="Description"
              className="rounded-md border border-[#a79e96] px-4 py-4 outline-none"
            />
            <div>
              <label className="mb-1 block text-sm text-[#4d4640]">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  updateForm("image", event.target.files?.[0] || null)
                }
                className="w-full rounded-md border border-dashed border-[#a79e96] px-4 py-3"
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
              required
              className="rounded-md border border-[#a79e96] px-4 py-4 outline-none"
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
              required
              className="rounded-md border border-[#a79e96] px-4 py-4 outline-none"
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
              required
              className="rounded-md border border-[#a79e96] px-4 py-4 outline-none"
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
              required
              className="rounded-md border border-[#a79e96] px-4 py-4 outline-none"
            />
          </div>

          <div className="rounded-xl border border-[#e4dacf]">
            <div className="flex flex-wrap items-center gap-4 border-b border-[#e9dfd5] px-4 py-4">
              <div className="flex items-center gap-2 text-[#4e443a]">
                <Search size={18} />
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search: All Text Columns"
                className="rounded-md border border-[#bcb2a8] px-4 py-3 outline-none"
              />
              <button type="button" className="font-semibold text-[#2e271f]">
                Go
              </button>
              <button
                type="button"
                onClick={addRow}
                className="font-semibold text-[#2e271f]"
              >
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead className="bg-white text-sm text-[#4e443a]">
                  <tr>
                    <th className="border-b border-r border-[#e9dfd5] px-4 py-4">
                      #
                    </th>
                    <th className="border-b border-r border-[#e9dfd5] px-4 py-4">
                      Item Code
                    </th>
                    <th className="border-b border-r border-[#e9dfd5] px-4 py-4">
                      Item Name
                    </th>
                    <th className="border-b border-r border-[#e9dfd5] px-4 py-4">
                      Pegs
                    </th>
                    <th className="border-b border-r border-[#e9dfd5] px-4 py-4">
                      Member Price
                    </th>
                    <th className="border-b border-r border-[#e9dfd5] px-4 py-4">
                      Non Member Price
                    </th>
                    <th className="border-b px-4 py-4">Delete Row</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={row.id} className="bg-[#f7fff8]">
                      <td className="border-b border-r border-[#e9dfd5] px-2 py-3">
                        {index + 1}
                      </td>
                      <td className="border-b border-r border-[#e9dfd5] px-2 py-3">
                        <select
                          value={row.itemCode}
                          onChange={(event) =>
                            handleItemCodeChange(row.id, event.target.value)
                          }
                          className="w-full bg-transparent text-center outline-none"
                        >
                          <option value="">Select Item</option>
                          {ingredientOptions.map((option) => (
                            <option key={option.ITEM_CODE} value={option.ITEM_CODE}>
                              {option.ITEM_CODE}-{option.ITEM_NAME}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-r border-[#e9dfd5] px-2 py-3">
                        <input
                          value={row.itemName}
                          readOnly
                          className="w-full bg-transparent text-center outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-[#e9dfd5] px-2 py-3">
                        <input
                          value={row.pegs}
                          onChange={(event) =>
                            handlePegsChange(row.id, event.target.value)
                          }
                          className="w-full bg-transparent text-center outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-[#e9dfd5] px-2 py-3">
                        <input
                          value={row.memberPrice}
                          readOnly
                          className="w-full bg-transparent text-center outline-none"
                        />
                      </td>
                      <td className="border-b border-r border-[#e9dfd5] px-2 py-3">
                        <input
                          value={row.nonMemberPrice}
                          readOnly
                          className="w-full bg-transparent text-center outline-none"
                        />
                      </td>
                      <td className="border-b px-2 py-3">
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          className="font-semibold text-[#9a2c2c]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 text-sm text-[#5c534b]">
              <span>{filteredRows.length} rows selected</span>
              <span>Total {rows.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
