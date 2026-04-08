import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaPlus, FaSearch, FaPen } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { inventoryAPI } from "../../services/api";

export default function Inventory() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [barTypes, setBarTypes] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [formValues, setFormValues] = useState({
    itemName: "",
    description: "",
    categoryId: "",
    subCategory: "",
    acUnit: "Nos",
    prepCharges: "N",
    image: null,
  });
  const [saving, setSaving] = useState(false);
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState("");
  const [imageSaving, setImageSaving] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageForm, setImageForm] = useState({
    itemCode: "",
    itemName: "",
    image: null,
    currentImage: "",
  });
  const [stockForm, setStockForm] = useState({
    itemCode: "",
    itemName: "",
    transactionDate: "",
    acUnit: "",
    rate: "",
    quantity: 1,
    volume: "",
    barcode: "",
    batchId: "",
    prepCharges: "N",
  });

  const fetchCategories = async () => {
    try {
      const response = await inventoryAPI.getCategories();
      setCategories(response.data.data || []);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const fetchItems = async (category) => {
    try {
      const response = await inventoryAPI.getItems(
        category ? { categoryId: category } : undefined
      );
      setItems(response.data.data || []);
    } catch (err) {
      console.error("Failed to load items:", err);
    }
  };

  const fetchSubCategories = async (category) => {
    try {
      const response = await inventoryAPI.getSubCategories(
        category ? { categoryId: category } : undefined
      );
      setSubCategories(response.data.data || []);
    } catch (err) {
      console.error("Failed to load sub-categories:", err);
    }
  };

  const fetchInventory = useCallback(async (options = {}) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        categoryId: (options.categoryId ?? categoryId) || undefined,
        itemCode: (options.itemCode ?? itemCode) || undefined,
        q: (options.search ?? search) || undefined,
      };
      const response = await inventoryAPI.getAll(params);
      setInventory(response.data.data || []);
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, itemCode, search]);

  const fetchBarTypes = async () => {
    try {
      const response = await inventoryAPI.getBarTypes();
      setBarTypes(response.data.data || []);
    } catch (err) {
      console.error("Failed to load bar types:", err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchItems();
    fetchSubCategories();
    fetchBarTypes();
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    fetchItems(categoryId || "");
    setItemCode("");
  }, [categoryId]);

  useEffect(() => {
    fetchSubCategories(formValues.categoryId || "");
  }, [formValues.categoryId]);

  useEffect(() => {
    fetchInventory({ categoryId, itemCode, search });
  }, [categoryId, itemCode, search, fetchInventory]);

  const filteredItems = useMemo(() => items, [items]);

  const formatDate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const openAddModal = () => {
    setFormValues({
      itemName: "",
      description: "",
      categoryId: "",
      subCategory: "",
      acUnit: "Nos",
      prepCharges: "N",
      image: null,
    });
    setShowAddModal(true);
  };

  const handleCreateItem = async () => {
    if (!formValues.itemName || !formValues.categoryId) {
      setError("Item name and category are required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("itemName", formValues.itemName);
      formData.append("description", formValues.description);
      formData.append("categoryId", formValues.categoryId);
      formData.append("subCategory", formValues.subCategory);
      formData.append("acUnit", formValues.acUnit);
      formData.append("prepCharges", formValues.prepCharges);
      formData.append("createdBy", "ADMIN");
      if (formValues.image) {
        formData.append("image", formValues.image);
      }

      await inventoryAPI.createWithImage(formData);
      setShowAddModal(false);
      fetchInventory();
    } catch (err) {
      console.error("Failed to create item:", err);
      setError("Failed to create item.");
    } finally {
      setSaving(false);
    }
  };

  const openStockModal = (row) => {
    setStockError("");
    setStockForm({
      itemCode: row.item_code,
      itemName: row.item_name,
      transactionDate: formatDate(new Date()),
      acUnit: row.ac_unit || "",
      rate: "",
      quantity: 1,
      volume: "",
      barcode: "",
      batchId: "",
      prepCharges: "N",
    });
    setShowStockModal(true);
  };

  const openImageModal = (row) => {
    setImageError("");
    setImageForm({
      itemCode: row.item_code,
      itemName: row.item_name,
      image: null,
      currentImage: row.file_name || "",
    });
    setShowImageModal(true);
  };

  const handleAddStock = async () => {
    if (!stockForm.itemCode || !stockForm.rate || !stockForm.barcode || !stockForm.transactionDate) {
      setStockError("Item code, barcode, rate, and transaction date are required.");
      return;
    }

    setStockSaving(true);
    setStockError("");
    try {
      await inventoryAPI.addStock({
        itemCode: stockForm.itemCode,
        quantity: stockForm.quantity,
        transactionDate: stockForm.transactionDate,
        volume: stockForm.volume,
        barcode: stockForm.barcode,
        rate: stockForm.rate,
        batchId: stockForm.batchId,
        prepCharges: stockForm.prepCharges,
        acUnit: stockForm.acUnit,
        createdBy: "ADMIN",
      });
      setShowStockModal(false);
      fetchInventory();
    } catch (err) {
      console.error("Failed to add stock:", err);
      setStockError(err.response?.data?.message || "Failed to add stock.");
    } finally {
      setStockSaving(false);
    }
  };

  const handleUpdateImage = async () => {
    if (!imageForm.itemCode || !imageForm.image) {
      setImageError("Please select an image.");
      return;
    }

    setImageSaving(true);
    setImageError("");
    try {
      const formData = new FormData();
      formData.append("image", imageForm.image);
      await inventoryAPI.updateImage(imageForm.itemCode, formData);
      setShowImageModal(false);
      fetchInventory();
    } catch (err) {
      console.error("Failed to update image:", err);
      setImageError(err.response?.data?.message || "Failed to update image.");
    } finally {
      setImageSaving(false);
    }
  };

  const getImageUrl = (fileName) => {
    if (!fileName) return "";
    const baseUrl =
      process.env.REACT_APP_API_URL || "http://localhost:5000/api";
    return `${baseUrl.replace(/\/api\/?$/, "")}/uploads/${fileName}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-white relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-[#d70652]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-[#ff025e]/10 rounded-full blur-3xl"></div>

      <div className="p-8 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">
            Inventory Management
          </h1>
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow hover:shadow-md border border-white/60 text-gray-700"
          >
            <FaArrowLeft />
            Go To Dashboard
          </button>
        </div>

        <div className="bg-white/80 border border-white/60 rounded-3xl shadow-xl backdrop-blur-sm p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name
              </label>
              <select
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20"
              >
                <option value="">All Items</option>
                {filteredItems.map((item) => (
                  <option key={item.item_code} value={item.item_code}>
                    {item.item_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <label className="block text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <FaSearch className="text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search item"
                    className="w-full bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchInventory({ search })}
                  className="px-5 py-3 rounded-2xl bg-[#5b5b5b] text-white font-semibold flex items-center gap-2 shadow hover:shadow-md"
                >
                  <FaSearch />
                  Search
                </button>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="w-full lg:w-auto px-5 py-3 rounded-2xl border border-[#ff025e] text-[#ff025e] font-semibold flex items-center gap-2"
              >
                <FaPlus />
                Add New Item
              </button>
            </div>
          </div>

          <div className="mt-8">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Add Stock</th>
                    <th className="px-4 py-3 text-left font-medium">Update Image</th>
                    <th className="px-4 py-3 text-left font-medium">Item Name</th>
                    <th className="px-4 py-3 text-left font-medium">A/C Unit</th>
                    <th className="px-4 py-3 text-left font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
                        Loading inventory...
                      </td>
                    </tr>
                  ) : inventory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-6 text-center text-gray-500">
                        No items found.
                      </td>
                    </tr>
                  ) : (
                    inventory.map((row) => (
                      <tr key={row.item_id} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openStockModal(row)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-[#d70652] hover:bg-[#d70652]/10"
                            title="Add stock"
                          >
                            <FaPen />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openImageModal(row)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-[#d70652] hover:bg-[#d70652]/10"
                            title="Update image"
                          >
                            <FaPen />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {row.item_name}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.ac_unit}</td>
                        <td className="px-4 py-3 text-gray-700">{row.stock_quantity}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-5xl rounded-3xl bg-white/95 shadow-2xl border border-white/70 backdrop-blur-md p-8 relative">
            <button
              type="button"
              onClick={() => setShowStockModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              X
            </button>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Item Transaction</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddStock}
                  disabled={stockSaving}
                  className="px-6 py-2.5 rounded-full bg-green-600 text-white font-semibold disabled:opacity-70"
                >
                  {stockSaving ? "Saving..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-6 py-2.5 rounded-full bg-gray-600 text-white font-semibold"
                >
                  Back
                </button>
              </div>
            </div>

            {stockError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {stockError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name
                </label>
                <input
                  type="text"
                  value={stockForm.itemName}
                  readOnly
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Date
                </label>
                <input
                  type="date"
                  value={stockForm.transactionDate}
                  onChange={(e) =>
                    setStockForm((prev) => ({
                      ...prev,
                      transactionDate: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={stockForm.acUnit}
                  onChange={(e) =>
                    setStockForm((prev) => ({ ...prev, acUnit: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                >
                  <option value="">Select type</option>
                  {barTypes.map((type) => (
                    <option key={type.type_id} value={type.type}>
                      {type.type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit Selling Rate
                </label>
                <input
                  type="number"
                  value={stockForm.rate}
                  onChange={(e) =>
                    setStockForm((prev) => ({ ...prev, rate: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={stockForm.quantity}
                  readOnly
                  className="w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Volume
                </label>
                <input
                  type="text"
                  value={stockForm.volume}
                  onChange={(e) =>
                    setStockForm((prev) => ({ ...prev, volume: e.target.value }))
                  }
                  placeholder="e.g., 750ML"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barcode
                </label>
                <input
                  type="text"
                  value={stockForm.barcode}
                  onChange={(e) =>
                    setStockForm((prev) => ({ ...prev, barcode: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch ID
                </label>
                <input
                  type="text"
                  value={stockForm.batchId}
                  onChange={(e) =>
                    setStockForm((prev) => ({ ...prev, batchId: e.target.value }))
                  }
                  placeholder="Enter batch ID"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div className="lg:col-span-2 flex items-center gap-6">
                <span className="text-sm font-medium text-gray-700">
                  Preparation Charges
                </span>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="stockPrep"
                    value="N"
                    checked={stockForm.prepCharges === "N"}
                    onChange={(e) =>
                      setStockForm((prev) => ({
                        ...prev,
                        prepCharges: e.target.value,
                      }))
                    }
                  />
                  N
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="stockPrep"
                    value="Y"
                    checked={stockForm.prepCharges === "Y"}
                    onChange={(e) =>
                      setStockForm((prev) => ({
                        ...prev,
                        prepCharges: e.target.value,
                      }))
                    }
                  />
                  Y
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white/95 shadow-2xl border border-white/70 backdrop-blur-md p-8 relative">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              X
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name
                </label>
                <input
                  type="text"
                  value={formValues.itemName}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, itemName: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formValues.description}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formValues.categoryId}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      categoryId: e.target.value,
                      subCategory: "",
                    }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub Category
                </label>
                <select
                  value={formValues.subCategory}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, subCategory: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
                >
                  <option value="">Select Sub Category</option>
                  {subCategories.map((sub) => (
                    <option key={sub.sub_category_id} value={sub.sub_category_id}>
                      {sub.sub_category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      image: e.target.files?.[0] || null,
                    }))
                  }
                  className="w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accounting Unit
                </label>
                <select
                  value={formValues.acUnit}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, acUnit: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800"
                >
                  <option value="Nos">Nos</option>
                  <option value="Pegs">Pegs</option>
                  <option value="Glass">Glass</option>
                  <option value="Mug">Mug</option>
                  <option value="Can">Can</option>
                </select>
              </div>

              <div className="md:col-span-2 flex items-center gap-6">
                <span className="text-sm font-medium text-gray-700">
                  Preparation charges
                </span>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="prepCharges"
                    value="N"
                    checked={formValues.prepCharges === "N"}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        prepCharges: e.target.value,
                      }))
                    }
                  />
                  N
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="prepCharges"
                    value="Y"
                    checked={formValues.prepCharges === "Y"}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        prepCharges: e.target.value,
                      }))
                    }
                  />
                  Y
                </label>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-3 rounded-full bg-gray-600 text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreateItem}
                disabled={saving}
                className="px-8 py-3 rounded-full bg-green-600 text-white font-semibold disabled:opacity-70"
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white/95 shadow-2xl border border-white/70 backdrop-blur-md p-8 relative">
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              X
            </button>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Update Image</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleUpdateImage}
                  disabled={imageSaving}
                  className="px-6 py-2.5 rounded-full bg-green-600 text-white font-semibold disabled:opacity-70"
                >
                  {imageSaving ? "Saving..." : "Update"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-6 py-2.5 rounded-full bg-gray-600 text-white font-semibold"
                >
                  Back
                </button>
              </div>
            </div>

            {imageError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {imageError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Image
                </label>
                <div className="w-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-gray-700 flex items-center justify-center min-h-[140px]">
                  {imageForm.currentImage ? (
                    <img
                      src={getImageUrl(imageForm.currentImage)}
                      alt={imageForm.itemName || "Item image"}
                      className="max-h-40 object-contain"
                    />
                  ) : (
                    <span className="text-sm text-gray-500">No image</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name
                </label>
                <input
                  type="text"
                  value={imageForm.itemName}
                  readOnly
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImageForm((prev) => ({
                      ...prev,
                      image: e.target.files?.[0] || null,
                    }))
                  }
                  className="w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-gray-700"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
