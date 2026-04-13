import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaChevronDown, FaPlus, FaSearch, FaPen, FaTrash,FaCamera } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import BarcodeScanner from "../../components/common/BarcodeScanner";
import { inventoryAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";


const requiresVolume = (acUnit) => String(acUnit || "").trim().toUpperCase() !== "NOS";

const isValidBarcode = (value) => /^\d{4,32}$/.test(String(value || "").trim());

// const getCurrentUsername = () => {
//   try {
//     const rawUser =
//       localStorage.getItem("user") || localStorage.getItem("authUser");
//     if (!rawUser) return "";
//     const user = JSON.parse(rawUser);
//     console.log("user", user);
//     const Username =  user?.username || user?.email || user?.user_name || user?.name || "ADMIN";
//     console.log("userq", Username);
//     return Username
//   } catch (_error) {
//     return "ADMIN";
//   }
// };
// console.log("created",currentLoggedInUser());

export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  console.log("user", user);
const currentLoggedInUser =
    user?.username || user?.email || user?.user_name || user?.name || "";
  console.log("currentLoggedInUser", currentLoggedInUser);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [barTypes, setBarTypes] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [itemCode, setItemCode] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [addCategoryFilter, setAddCategoryFilter] = useState("");
  const [isAddCategoryDropdownOpen, setIsAddCategoryDropdownOpen] = useState(false);
  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false);
 
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
  const [scannerOpen, setScannerOpen] = useState(false);
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
  const [stockRows, setStockRows] = useState([]);
  const [stockRowSearch, setStockRowSearch] = useState("");
  const [inventorySearchInput, setInventorySearchInput] = useState("");
  const categoryDropdownRef = useRef(null);
  const itemDropdownRef = useRef(null);
  const addCategoryDropdownRef = useRef(null);
  const subCategoryDropdownRef = useRef(null);
  const searchRef = useRef("");

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
        q: (options.search ?? searchRef.current) || undefined,
      };
      const response = await inventoryAPI.getAll(params);
      const rows = response.data.data || [];
      setInventory(
        rows.filter((row) => {
          if (row?.sub_category == null) return true;
          return ![14, 15].includes(Number(row.sub_category));
        })
      );
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, itemCode]);

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
  }, []);

  useEffect(() => {
    fetchItems(categoryId || "");
    setItemCode("");
    setItemFilter("");
    setIsItemDropdownOpen(false);
  }, [categoryId]);

  useEffect(() => {
    fetchSubCategories(formValues.categoryId || "");
  }, [formValues.categoryId]);

  useEffect(() => {
    fetchInventory({ categoryId, itemCode, search });
  }, [fetchInventory, categoryId, itemCode]);

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

      if (
        addCategoryDropdownRef.current &&
        !addCategoryDropdownRef.current.contains(event.target)
      ) {
        setIsAddCategoryDropdownOpen(false);
      }

      if (
        subCategoryDropdownRef.current &&
        !subCategoryDropdownRef.current.contains(event.target)
      ) {
        setIsSubCategoryDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cleanedCategories = useMemo(
    () =>
      categories.filter(
        (category) => String(category.category_name || "").trim() !== ""
      ),
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const query = categoryFilter.trim().toLowerCase();
    if (!query) return cleanedCategories;

    return cleanedCategories.filter((category) =>
      String(category.category_name || "").toLowerCase().includes(query)
    );
  }, [categoryFilter, cleanedCategories]);

  const filteredItems = useMemo(() => {
    const query = itemFilter.trim().toLowerCase();
    const cleanedItems = items.filter(
      (item) => String(item.item_name || "").trim() !== ""
    );
    if (!query) return cleanedItems;

    return cleanedItems.filter((item) =>
      String(item.item_name || "").toLowerCase().includes(query)
    );
  }, [itemFilter, items]);

  const selectedCategory = useMemo(
    () =>
      cleanedCategories.find(
        (category) => String(category.category_id) === String(categoryId)
      ),
    [cleanedCategories, categoryId]
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.item_code === itemCode),
    [items, itemCode]
  );

  const filteredAddCategories = useMemo(() => {
    const query = addCategoryFilter.trim().toLowerCase();
    if (!query) return cleanedCategories;

    return cleanedCategories.filter((category) =>
      String(category.category_name || "").toLowerCase().includes(query)
    );
  }, [addCategoryFilter, cleanedCategories]);

  const filteredAddSubCategories = useMemo(() => {
    const query = subCategoryFilter.trim().toLowerCase();
    const cleanedSubCategories = subCategories.filter(
      (sub) => String(sub.sub_category_name || "").trim() !== ""
    );
    if (!query) return cleanedSubCategories;

    return cleanedSubCategories.filter((sub) =>
      String(sub.sub_category_name || "").toLowerCase().includes(query)
    );
  }, [subCategoryFilter, subCategories]);

  const selectedAddCategory = useMemo(
    () =>
      cleanedCategories.find(
        (category) => String(category.category_id) === String(formValues.categoryId)
      ),
    [cleanedCategories, formValues.categoryId]
  );
  const selectedAddSubCategory = useMemo(
    () =>
      subCategories.find(
        (sub) => String(sub.sub_category_id) === String(formValues.subCategory)
      ),
    [formValues.subCategory, subCategories]
  );

  const formatDate = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDisplayDate = (value) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`;
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
    setAddCategoryFilter("");
    setIsAddCategoryDropdownOpen(false);
    setSubCategoryFilter("");
    setIsSubCategoryDropdownOpen(false);
    setShowAddModal(true);
  };

  const handleCreateItem = async () => {
    const trimmedItemName = String(formValues.itemName || "").trim();
    const duplicateItem = items.some(
      (item) => String(item.item_name || "").trim().toLowerCase() === trimmedItemName.toLowerCase()
    );

    if (!trimmedItemName || !formValues.categoryId) {
      setError("Item name and category are required.");
      return;
    }

    if (!formValues.subCategory) {
      setError("Sub category is required.");
      return;
    }

    if (!formValues.acUnit) {
      setError("Accounting unit is required.");
      return;
    }

    if (!formValues.prepCharges) {
      setError("Preparation charges selection is required.");
      return;
    }

    if (duplicateItem) {
      setError("Item name already exists.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("itemName", trimmedItemName);
      formData.append("description", formValues.description);
      formData.append("categoryId", formValues.categoryId);
      formData.append("subCategory", formValues.subCategory);
      formData.append("acUnit", formValues.acUnit);
      formData.append("prepCharges", formValues.prepCharges);
      console.log("createdBy", currentLoggedInUser)
      formData.append("createdBy", currentLoggedInUser);
      if (formValues.image) {
        formData.append("image", formValues.image);
      }

      await inventoryAPI.createWithImage(formData);
      setShowAddModal(false);
      fetchItems(categoryId || "");
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
    setStockRows([]);
    setStockRowSearch("");
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

  const closeStockModal = () => {
    setShowStockModal(false);
    setStockError("");
    setStockRows([]);
    setStockRowSearch("");
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

  const stageStockRow = useCallback(async (barcodeValue = stockForm.barcode) => {
    const normalizedBarcode = String(barcodeValue || "").trim();

    if (!stockForm.itemCode || !stockForm.rate || !normalizedBarcode || !stockForm.transactionDate) {
      setStockError("Item code, barcode, rate, and transaction date are required.");
      return;
    }

    if (!Number.isFinite(Number(stockForm.rate)) || Number(stockForm.rate) <= 0) {
      setStockError("Unit selling rate must be greater than 0.");
      return;
    }

    if (!Number.isInteger(Number(stockForm.quantity)) || Number(stockForm.quantity) <= 0) {
      setStockError("Quantity must be a whole number greater than 0.");
      return;
    }

    if (!isValidBarcode(normalizedBarcode)) {
      setStockError("Barcode must be 4 to 32 digits.");
      return;
    }

    if (requiresVolume(stockForm.acUnit) && !String(stockForm.volume || "").trim()) {
      setStockError("Volume is required for the selected type.");
      return;
    }

    if (stockRows.some((row) => row.barcode === normalizedBarcode)) {
      setStockError("This barcode is already staged.");
      return;
    }

    setStockError("");

    try {
      const response = await inventoryAPI.checkBarcodeExists(normalizedBarcode);
      if (response.data?.exists) {
        setStockError("This barcode already exists.");
        return;
      }
    } catch (err) {
      console.error("Failed to verify barcode:", err);
      setStockError("Unable to verify barcode uniqueness.");
      return;
    }

    setStockRows((current) => [
      ...current,
      {
        itemCode: stockForm.itemCode,
        itemName: stockForm.itemName,
        quantity: 1,
        barcode: normalizedBarcode,
        batchName: `${stockForm.itemName}-1-${stockForm.volume || ""}-${formatDisplayDate(
          stockForm.transactionDate
        )}`,
        rate: stockForm.rate,
        transactionDate: stockForm.transactionDate,
        displayTransactionDate: formatDisplayDate(stockForm.transactionDate),
        volume: stockForm.volume,
        acUnit: stockForm.acUnit,
        prepCharges: stockForm.prepCharges,
      },
    ]);

    setStockForm((prev) => ({
      ...prev,
      barcode: "",
    }));
  }, [stockForm, stockRows]);

  const handleStageStock = async () => {
    await stageStockRow(stockForm.barcode);
  };

  const handleScannerClose = useCallback(() => {
    setScannerOpen(false);
  }, []);

  const handleScan = useCallback(
    async (scannedValue) => {
      const normalizedBarcode = String(scannedValue || "").trim();
      setScannerOpen(false);
      setStockForm((prev) => ({ ...prev, barcode: normalizedBarcode }));
      await stageStockRow(normalizedBarcode);
    },
    [stageStockRow]
  );

  const handleDeleteStockRow = (barcode) => {
    setStockRows((current) => current.filter((row) => row.barcode !== barcode));
  };

  const handleCancelStockRows = () => {
    setStockRows([]);
    setStockRowSearch("");
    setStockError("");
  };

  const handleAddStock = async () => {
    if (stockRows.length === 0) {
      setStockError("Add at least one stock row before saving.");
      return;
    }

    setStockSaving(true);
    setStockError("");
    try {
      await inventoryAPI.addStock({
        items: stockRows.map((row) => ({
          itemCode: row.itemCode,
          quantity: 1,
          transactionDate: row.transactionDate,
          volume: row.volume,
          barcode: row.barcode,
          rate: row.rate,
          prepCharges: row.prepCharges,
          acUnit: row.acUnit,
          createdBy: currentLoggedInUser,
        })),
      });
      closeStockModal();
      fetchInventory();
    } catch (err) {
      console.error("Failed to add stock:", err);
      setStockError(err.response?.data?.message || "Failed to add stock.");
    } finally {
      setStockSaving(false);
    }
  };

  const filteredStockRows = useMemo(() => {
    const query = stockRowSearch.trim().toLowerCase();
    if (!query) return stockRows;
    return stockRows.filter((row) =>
      [
        row.itemName,
        row.barcode,
        row.batchName,
        row.volume,
        row.rate,
        row.displayTransactionDate,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [stockRowSearch, stockRows]);

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
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() =>
                    setIsCategoryDropdownOpen((prev) => !prev)
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20 flex items-center justify-between"
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
                  <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
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
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#ff025e]/5 ${
                          !categoryId
                            ? "bg-[#ff025e]/10 font-medium text-[#d70652]"
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
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#ff025e]/5 ${
                              String(categoryId) === String(category.category_id)
                                ? "bg-[#ff025e]/10 font-medium text-[#d70652]"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name
              </label>
              <div className="relative" ref={itemDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsItemDropdownOpen((prev) => !prev)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20 flex items-center justify-between"
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
                  <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
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
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#ff025e]/5 ${
                          !itemCode ? "bg-[#ff025e]/10 font-medium text-[#d70652]" : "text-gray-700"
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
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#ff025e]/5 ${
                              itemCode === item.item_code
                                ? "bg-[#ff025e]/10 font-medium text-[#d70652]"
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

            <div className="flex flex-col gap-3">
              <label className="block text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                  <FaSearch className="text-gray-400" />
                  <input
                    type="text"
                    value={inventorySearchInput}
                    onChange={(e) => setInventorySearchInput(e.target.value)}
                    placeholder="Search item"
                    className="w-full bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch(inventorySearchInput.trim());
                    fetchInventory({ search: inventorySearchInput.trim() });
                  }}
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-6">
          <div className="mx-auto w-full max-w-5xl rounded-3xl bg-white/95 shadow-2xl border border-white/70 backdrop-blur-md p-8 relative max-h-[calc(100vh-3rem)] overflow-y-auto">
            <button
              type="button"
              onClick={closeStockModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              X
            </button>

            <div className="sticky top-0 z-10 -mx-8 mb-6 flex items-center justify-between border-b border-gray-100 bg-white/95 px-8 py-4 backdrop-blur-md">
              <h2 className="text-xl font-semibold text-gray-800">Item Transaction</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAddStock}
                  disabled={stockSaving || stockRows.length === 0}
                  className="px-6 py-2.5 rounded-full bg-green-600 text-white font-semibold disabled:opacity-70"
                >
                  {stockSaving ? "Saving..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={closeStockModal}
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

            <div className="mt-8 rounded-3xl border border-gray-200 bg-white shadow-sm">
              <button
                             type="button"
                             onClick={() => setScannerOpen(true)}
                             className="flex items-center gap-2 rounded-2xl bg-[#d70652] px-5 py-3 font-semibold text-white shadow hover:shadow-md"
                           >
                             <FaCamera />
                             Scan
                           </button>
              <div className="min-h-[140px] border-b border-gray-100 bg-[radial-gradient(circle_at_center,rgba(215,6,82,0.06),transparent_42%)]"></div>

              <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                <button
                  type="button"
                  onClick={handleCancelStockRows}
                  className="rounded-full bg-gray-600 px-5 py-2.5 text-white font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleStageStock}
                  className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-2.5 text-white font-semibold"
                >
                  <FaPlus />
                  Add Stock
                </button>
              </div>

              <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
                <FaSearch className="text-gray-400" />
                <input
                  type="text"
                  value={stockRowSearch}
                  onChange={(e) => setStockRowSearch(e.target.value)}
                  placeholder="Search staged rows"
                  className="w-40 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none"
                />
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-sm font-medium text-gray-700"
                >
                  Go
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Item Name</th>
                      <th className="px-4 py-3 text-left font-medium">Quantity</th>
                      <th className="px-4 py-3 text-left font-medium">Barcode</th>
                      <th className="px-4 py-3 text-left font-medium">Batchname</th>
                      <th className="px-4 py-3 text-left font-medium">Rate</th>
                      <th className="px-4 py-3 text-left font-medium">Transaction Date</th>
                      <th className="px-4 py-3 text-left font-medium">Volume</th>
                      <th className="px-4 py-3 text-left font-medium">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStockRows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                          No staged stock rows yet.
                        </td>
                      </tr>
                    ) : (
                      filteredStockRows.map((row) => (
                        <tr key={row.barcode} className="border-t border-gray-100">
                          <td className="px-4 py-3">{row.itemName}</td>
                          <td className="px-4 py-3">{row.quantity}</td>
                          <td className="px-4 py-3">{row.barcode}</td>
                          <td className="px-4 py-3">{row.batchName}</td>
                          <td className="px-4 py-3">{row.rate}</td>
                          <td className="px-4 py-3">{row.displayTransactionDate}</td>
                          <td className="px-4 py-3">{row.volume}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteStockRow(row.barcode)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-red-600 hover:bg-red-50"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 text-right text-sm text-gray-500">
                {filteredStockRows.length}-{stockRows.length}
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
                <div className="relative" ref={addCategoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsAddCategoryDropdownOpen((prev) => !prev)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20 flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedAddCategory?.category_name || "Select Category"}
                    </span>
                    <FaChevronDown
                      className={`text-gray-400 transition-transform ${
                        isAddCategoryDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isAddCategoryDropdownOpen && (
                    <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
                      <div className="border-b border-gray-100 p-3">
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                          <FaSearch className="text-gray-400" />
                          <input
                            type="text"
                            value={addCategoryFilter}
                            onChange={(e) => setAddCategoryFilter(e.target.value)}
                            placeholder="Search category name"
                            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                          />
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto py-2">
                        {filteredAddCategories.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            No matching categories found.
                          </div>
                        ) : (
                          filteredAddCategories.map((category) => (
                            <button
                              key={category.category_id}
                              type="button"
                              onClick={() => {
                                setFormValues((prev) => ({
                                  ...prev,
                                  categoryId: category.category_id,
                                  subCategory: "",
                                }));
                                setAddCategoryFilter(category.category_name || "");
                                setSubCategoryFilter("");
                                setIsAddCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#ff025e]/5 ${
                                String(formValues.categoryId) === String(category.category_id)
                                  ? "bg-[#ff025e]/10 font-medium text-[#d70652]"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub Category
                </label>
                <div className="relative" ref={subCategoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsSubCategoryDropdownOpen((prev) => !prev)}
                    disabled={!formValues.categoryId}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-[#ff025e] focus:ring-2 focus:ring-[#ff025e]/20 flex items-center justify-between disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="truncate">
                      {selectedAddSubCategory?.sub_category_name ||
                        (formValues.categoryId
                          ? "Select Sub Category"
                          : "Select Category First")}
                    </span>
                    <FaChevronDown
                      className={`text-gray-400 transition-transform ${
                        isSubCategoryDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isSubCategoryDropdownOpen && formValues.categoryId && (
                    <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
                      <div className="border-b border-gray-100 p-3">
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                          <FaSearch className="text-gray-400" />
                          <input
                            type="text"
                            value={subCategoryFilter}
                            onChange={(e) => setSubCategoryFilter(e.target.value)}
                            placeholder="Search sub category"
                            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                          />
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto py-2">
                        {filteredAddSubCategories.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            No matching sub categories found.
                          </div>
                        ) : (
                          filteredAddSubCategories.map((sub) => (
                            <button
                              key={sub.sub_category_id}
                              type="button"
                              onClick={() => {
                                setFormValues((prev) => ({
                                  ...prev,
                                  subCategory: sub.sub_category_id,
                                }));
                                setSubCategoryFilter(sub.sub_category_name || "");
                                setIsSubCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[#ff025e]/5 ${
                                String(formValues.subCategory) === String(sub.sub_category_id)
                                  ? "bg-[#ff025e]/10 font-medium text-[#d70652]"
                                  : "text-gray-700"
                              }`}
                            >
                              {sub.sub_category_name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
       <BarcodeScanner isOpen={scannerOpen} onClose={handleScannerClose} onScan={handleScan} />
    </div>
  );
}
