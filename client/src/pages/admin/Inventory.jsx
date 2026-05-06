import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaChevronDown, FaPlus, FaSearch, FaPen, FaTrash,FaCamera } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import BarcodeScanner from "../../components/common/BarcodeScanner";
import { API_BASE_URL, inventoryAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";


const requiresVolume = (acUnit) => String(acUnit || "").trim().toUpperCase() !== "NOS";

const isValidBarcode = (value) => /^\d{4,32}$/.test(String(value || "").trim());

const toInitCap = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase());

const getAllowedAcUnits = (categoryId, subCategoryId) => {
  const cat = Number(categoryId);
  const sub = Number(subCategoryId);
  if (!Number.isFinite(cat) || !Number.isFinite(sub)) return [];

  const allowed = new Set();

  if (cat === 10) {
    if ([2, 4, 5, 8, 11, 12, 16, 17].includes(sub)) allowed.add("Pegs");
    if ([1, 3, 1310].includes(sub)) allowed.add("Nos");
    if ([1].includes(sub)) {
      allowed.add("Can");
      allowed.add("Mug");
    }
    if ([6].includes(sub)) {
      allowed.add("Glass");
      allowed.add("Nos");
    }
    if ([9].includes(sub)) {
      allowed.add("Glass");
      allowed.add("Nos");
    }
  }

  if (cat === 14) {
    if ([7, 10].includes(sub)) allowed.add("Nos");
  }

  return Array.from(allowed);
};


export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentLoggedInUser = useMemo(() => {
    if (user) {
      return user?.username || user?.email || user?.user_name || user?.name || "ADMIN";
    }

    try {
      const rawUser = localStorage.getItem("user") || localStorage.getItem("authUser");
      if (!rawUser) return "ADMIN";
      const parsed = JSON.parse(rawUser);
      return parsed?.username || parsed?.email || parsed?.user_name || parsed?.name || "ADMIN";
    } catch (_error) {
      return "ADMIN";
    }
  }, [user]);

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [itemCode, setItemCode] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addItemError, setAddItemError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isAddCategoryDropdownOpen, setIsAddCategoryDropdownOpen] = useState(false);
  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false);
  const [isAcUnitDropdownOpen, setIsAcUnitDropdownOpen] = useState(false);
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
  const [stockInfo, setStockInfo] = useState("");
  const [imageSaving, setImageSaving] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageCacheBusters, setImageCacheBusters] = useState({});
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
  const acUnitDropdownRef = useRef(null);
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
          stock_quantity: (Number.isFinite(existingQty) ? existingQty : 0) + (Number.isFinite(nextQty) ? nextQty : 0),
          file_name: existing?.file_name || row?.file_name || "",
        });
      });

      setInventory(Array.from(groupedByItemCode.values()));
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, itemCode]);

  useEffect(() => {
    fetchCategories();
    fetchItems();
    fetchSubCategories();
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

      if (
        acUnitDropdownRef.current &&
        !acUnitDropdownRef.current.contains(event.target)
      ) {
        setIsAcUnitDropdownOpen(false);
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

  const filteredAddCategories = useMemo(() => cleanedCategories, [cleanedCategories]);

  const filteredAddSubCategories = useMemo(() => {
    const query = subCategoryFilter.trim().toLowerCase();
    const excludedSubCategoryNames = new Set(["cocktail", "mocktail"]);
    const cleanedSubCategories = subCategories.filter(
      (sub) => {
        const name = String(sub.sub_category_name || "").trim();
        if (!name) return false;
        return !excludedSubCategoryNames.has(name.toLowerCase());
      }
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

  const allAcUnitOptions = useMemo(() => ["Nos", "Pegs", "Glass", "Mug", "Can"], []);

  const acUnitOptions = useMemo(() => {
    const allowed = getAllowedAcUnits(formValues.categoryId, formValues.subCategory);
    if (allowed.length === 0) return allAcUnitOptions;
    const normalizedAllowed = new Set(allowed.map((value) => String(value).toLowerCase()));
    return allAcUnitOptions.filter((value) => normalizedAllowed.has(String(value).toLowerCase()));
  }, [allAcUnitOptions, formValues.categoryId, formValues.subCategory]);

  useEffect(() => {
    const allowed = getAllowedAcUnits(formValues.categoryId, formValues.subCategory);
    if (allowed.length === 0) return;

    const allowedKeys = new Set(allowed.map((value) => String(value).toLowerCase()));
    const currentKey = String(formValues.acUnit || "").toLowerCase();

    if (!currentKey || !allowedKeys.has(currentKey)) {
      setFormValues((prev) => ({ ...prev, acUnit: allowed[0] }));
    }
  }, [formValues.categoryId, formValues.subCategory, formValues.acUnit]);

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
    setAddItemError("");
    setFormValues({
      itemName: "",
      description: "",
      categoryId: "",
      subCategory: "",
      acUnit: "Nos",
      prepCharges: "N",
      image: null,
    });
    setIsAddCategoryDropdownOpen(false);
    setSubCategoryFilter("");
    setIsSubCategoryDropdownOpen(false);
    setIsAcUnitDropdownOpen(false);
    setShowAddModal(true);
  };

  const handleCreateItem = async () => {
    const trimmedItemName = String(formValues.itemName || "").trim();
    const duplicateItem = items.some(
      (item) => String(item.item_name || "").trim().toLowerCase() === trimmedItemName.toLowerCase()
    );

    if (!trimmedItemName || !formValues.categoryId) {
      setAddItemError("Item name and category are required.");
      return;
    }

    if (!formValues.subCategory) {
      setAddItemError("Sub category is required.");
      return;
    }

    if (!formValues.acUnit) {
      setAddItemError("Accounting unit is required.");
      return;
    }

    if (!formValues.prepCharges) {
      setAddItemError("Preparation charges selection is required.");
      return;
    }

    if (duplicateItem) {
      setAddItemError("Item name already exists.");
      return;
    }

    setSaving(true);
    setAddItemError("");
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
      setAddItemError(err.response?.data?.message || "Failed to create item.");
    } finally {
      setSaving(false);
    }
  };

  const normalizeStockType = useCallback((value) => {
    const key = String(value || "").trim().toLowerCase();
    if (!key) return "";
    if (key === "free") return "Free";
    if (key === "purchase" || key === "purchased") return "Purchased";
    return "";
  }, []);

  const barTypeOptions = useMemo(
    () => [
      { value: "Free", label: "Free" },
      { value: "Purchased", label: "Purchased" },
    ],
    []
  );

  const openStockModal = (row) => {
    setStockError("");
    setStockInfo("");
    setStockRows([]);
    setStockRowSearch("");
    const normalizedType = normalizeStockType(row.ac_unit);
    setStockForm({
      itemCode: row.item_code,
      itemName: row.item_name,
      transactionDate: formatDate(new Date()),
      acUnit: normalizedType || "",
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
    setStockInfo("");
    setStockRows([]);
    setStockRowSearch("");
  };

  const openImageModal = (row) => {
    setImageError("");
    setImagePreviewUrl("");
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
    setStockInfo("");

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

    setStockInfo("Stock row staged.");

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
      if (stockForm.itemCode && stockForm.rate && stockForm.transactionDate) {
        await stageStockRow(normalizedBarcode);
      } else {
        setStockInfo("Scanned. Enter rate/date and click Add Stock to stage.");
      }
    },
    [stageStockRow, stockForm.itemCode, stockForm.rate, stockForm.transactionDate]
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
      const response = await inventoryAPI.updateImage(imageForm.itemCode, formData);
      const responseFileName =
        response?.data?.data?.file_name ||
        response?.data?.data?.fileName ||
        response?.data?.data?.filename ||
        response?.data?.file_name ||
        response?.data?.fileName ||
        response?.data?.filename ||
        "";

      setImageCacheBusters((prev) => ({
        ...prev,
        [imageForm.itemCode]: Date.now(),
      }));
      setImageForm((prev) => ({
        ...prev,
        currentImage: responseFileName || prev.currentImage,
        image: null,
      }));
      setImagePreviewUrl("");
      fetchInventory();
      setShowImageModal(false);
      navigate("/admin/stock-reports/barstock");
    } catch (err) {
      console.error("Failed to update image:", err);
      setImageError(err.response?.data?.message || "Failed to update image.");
    } finally {
      setImageSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const withCacheBuster = (url, cacheBuster) => {
    if (!url) return "";
    if (!cacheBuster) return url;
    return `${url}${url.includes("?") ? "&" : "?"}v=${cacheBuster}`;
  };

  const getImageUrl = (fileName) => {
    if (!fileName) return "";
    const raw = String(fileName).trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    const baseUrl =
      API_BASE_URL || process.env.REACT_APP_API_URL || "http://localhost:5000/api";
    const cleanBase = baseUrl.replace(/\/api\/?$/, "");
    const normalizedName = raw.split(/[\\/]/).pop();
    const encodedName = encodeURIComponent(normalizedName);
    return `${cleanBase}/uploads/${encodedName}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 relative">
      <div className="absolute top-16 left-12 w-72 h-72 bg-afmc-maroon/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-afmc-maroon2/10 rounded-full blur-3xl"></div>

      <div className="p-6 md:p-8 relative z-10">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-2xl font-semibold text-afmc-maroon">
            Inventory Management
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

        <div className="bg-white/80 border border-afmc-gold/15 rounded-3xl shadow-xl backdrop-blur-sm p-5 md:p-6">
          <div className="mb-5 md:mb-6 h-1 w-full rounded-full bg-gradient-to-r from-afmc-maroon via-afmc-gold to-afmc-maroon2" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6 items-end">
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
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 flex items-center justify-between"
                >
                  <span className="truncate">
                    {selectedCategory?.category_name || "All Categories"}
                  </span>
                  <FaChevronDown
                    className={`text-gray-400 transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""
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
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${!categoryId
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
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${String(categoryId) === String(category.category_id)
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Name
              </label>
              <div className="relative" ref={itemDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsItemDropdownOpen((prev) => !prev)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 flex items-center justify-between"
                >
                  <span className="truncate">
                    {selectedItem?.item_name || "All Items"}
                  </span>
                  <FaChevronDown
                    className={`text-gray-400 transition-transform ${isItemDropdownOpen ? "rotate-180" : ""
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
                        className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${!itemCode ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon" : "text-gray-700"
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
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${itemCode === item.item_code
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

            <div className="flex flex-col gap-3">

              {/* 🔼 Move this block to TOP (no style change) */}
             <button
  type="button"
  onClick={openAddModal}
  className="group relative inline-flex items-center gap-3 overflow-hidden rounded-xl 
  bg-afmc-maroon px-6 py-2.5 font-semibold text-white shadow-md 
  transition-all duration-300 ease-out
  hover:shadow-lg hover:-translate-y-[1px]
  focus:outline-none focus:ring-2 focus:ring-afmc-gold/60 focus:ring-offset-2"
>
  {/* Gold sheen overlay */}
  <span className="absolute inset-0 opacity-0 transition-opacity duration-500 
  group-hover:opacity-100 bg-gradient-to-r from-transparent via-afmc-gold/20 to-transparent" />

  {/* Border glow */}
  <span className="absolute inset-0 rounded-xl ring-1 ring-afmc-gold/20 
  group-hover:ring-afmc-gold/40 transition-all duration-300" />

  {/* Icon container */}
  <span className="relative flex h-9 w-9 items-center justify-center rounded-lg 
  bg-white/10 text-afmc-gold backdrop-blur-sm
  transition-all duration-300 group-hover:bg-white/20">
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  </span>

  {/* Text */}
  <span className="relative tracking-wide text-sm letter-spacing-wide">
    Add New Item
  </span>
</button>
              {/* Existing Search Label */}
              <label className="block text-sm font-medium text-gray-700">
                Search
              </label>

              {/* Existing Search Input + Button */}
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
                  className="px-5 py-3 rounded-2xl bg-afmc-maroon text-white font-semibold flex items-center gap-2 shadow-afmc hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50 transition"
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
                      <tr
                        key={row.item_id}
                        className="border-t border-gray-100 hover:bg-afmc-gold/10 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openStockModal(row)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-afmc-maroon hover:bg-afmc-maroon/10"
                            title="Add stock"
                          >
                            <FaPen />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openImageModal(row)}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-afmc-maroon hover:bg-afmc-maroon/10"
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
                  className="px-6 py-2.5 rounded-full bg-afmc-maroon text-white font-semibold shadow-afmc hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50 disabled:opacity-70"
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

            {stockInfo && !stockError && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {stockInfo}
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
                  {barTypeOptions.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
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
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={stockForm.barcode}
                    onChange={(e) =>
                      setStockForm((prev) => ({ ...prev, barcode: e.target.value }))
                    }
                    placeholder="Scan or type barcode"
                    className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#d70652] px-5 py-3 font-semibold text-white shadow hover:shadow-md"
                    title="Open scanner"
                  >
                    <FaCamera />
                    Scan
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Tip: After scanning, the row auto-stages when rate/date are filled.
                </p>
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
                  No
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
                  Yes
                </label>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-gray-200 bg-white shadow-sm">
              {/* <div className="border-b border-gray-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Scanner</div>
                    <div className="text-xs text-gray-500">
                      Use the Scan button near Barcode to open the camera.
                    </div>
                  </div>
                </div>
              </div> */}

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
                  className="inline-flex items-center gap-2 rounded-full bg-afmc-maroon px-5 py-2.5 text-white font-semibold shadow-afmc hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50"
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

            {addItemError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {addItemError}
              </div>
            )}

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
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 flex items-center justify-between"
                  >
                    <span className="truncate">
                      {selectedAddCategory?.category_name || "Select Category"}
                    </span>
                    <FaChevronDown
                      className={`text-gray-400 transition-transform ${isAddCategoryDropdownOpen ? "rotate-180" : ""
                        }`}
                    />
                  </button>

                  {isAddCategoryDropdownOpen && (
                    <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
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
                                setSubCategoryFilter("");
                                setIsAddCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${String(formValues.categoryId) === String(category.category_id)
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sub Category
                </label>
                <div className="relative" ref={subCategoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsSubCategoryDropdownOpen((prev) => !prev)}
                    disabled={!formValues.categoryId}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 flex items-center justify-between disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="truncate">
                      {toInitCap(selectedAddSubCategory?.sub_category_name) ||
                        (formValues.categoryId
                          ? "Select Sub Category"
                          : "Select Category First")}
                    </span>
                    <FaChevronDown
                      className={`text-gray-400 transition-transform ${isSubCategoryDropdownOpen ? "rotate-180" : ""
                        }`}
                    />
                  </button>

                  {isSubCategoryDropdownOpen && formValues.categoryId && (
                    <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
                      <div className="border-b border-gray-100 p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                            <FaSearch className="text-gray-400" />
                            <input
                              type="text"
                              value={subCategoryFilter}
                              onChange={(e) => setSubCategoryFilter(e.target.value)}
                              placeholder="Search sub category"
                              className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormValues((prev) => ({ ...prev, subCategory: "" }));
                              setSubCategoryFilter("");
                            }}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Reset
                          </button>
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
                                setSubCategoryFilter(toInitCap(sub.sub_category_name) || "");
                                setIsSubCategoryDropdownOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${String(formValues.subCategory) === String(sub.sub_category_id)
                                ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
                                : "text-gray-700"
                                }`}
                            >
                              {toInitCap(sub.sub_category_name)}
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
                <div className="relative" ref={acUnitDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsAcUnitDropdownOpen((prev) => !prev)}
                    disabled={!formValues.subCategory}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 flex items-center justify-between disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="truncate">{formValues.acUnit || "Select Unit"}</span>
                    <FaChevronDown
                      className={`text-gray-400 transition-transform ${isAcUnitDropdownOpen ? "rotate-180" : ""
                        }`}
                    />
                  </button>

                  {isAcUnitDropdownOpen && (
                    <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
                      <div className="max-h-72 overflow-y-auto py-2">
                        {acUnitOptions.map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => {
                              setFormValues((prev) => ({ ...prev, acUnit: unit }));
                              setIsAcUnitDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${String(formValues.acUnit).toLowerCase() === String(unit).toLowerCase()
                              ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
                              : "text-gray-700"
                              }`}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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
                  No
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
                  Yes
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
                className="px-8 py-3 rounded-full bg-afmc-maroon text-white font-semibold shadow-afmc hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50 disabled:opacity-70"
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
                  className="px-6 py-2.5 rounded-full bg-afmc-maroon text-white font-semibold shadow-afmc hover:bg-afmc-maroon2 focus:outline-none focus:ring-2 focus:ring-afmc-gold/50 disabled:opacity-70"
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
                  {imagePreviewUrl ? (
                    <img
                      src={imagePreviewUrl}
                      alt={imageForm.itemName || "Selected image preview"}
                      className="max-h-40 object-contain"
                    />
                  ) : imageForm.currentImage ? (
                    <img
                      src={withCacheBuster(
                        getImageUrl(imageForm.currentImage),
                        imageCacheBusters[imageForm.itemCode]
                      )}
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
                    setImageForm((prev) => {
                      const file = e.target.files?.[0] || null;
                      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                      setImagePreviewUrl(file ? URL.createObjectURL(file) : "");
                      return {
                        ...prev,
                        image: file,
                      };
                    })
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

