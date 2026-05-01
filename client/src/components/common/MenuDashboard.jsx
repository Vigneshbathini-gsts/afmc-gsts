import React, { useEffect, useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { ChevronsLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../services/api";

const BASEAPI = "https://afmc.globalsparkteksolutions.com/AFMCIMAGES/";

const menuConfig = {
  drinks: {
    label: "Drinks",
    sections: {
      soft: {
        label: "Soft Drinks",
        categories: [
          { key: "Others", label: "Others" },
          { key: "Mocktail", label: "Mocktails" },
        ],
      },
      hard: {
        label: "Hard Drinks",
        categories: [],
      },
    },
  },
  snacks: {
    label: "Snacks",
    sections: {
      veg: {
        label: "Veg",
        categories: [],
      },
      nonVeg: {
        label: "Non-Veg",
        categories: [],
      },
    },
  },
};

const hardDrinkCategories = [
  { label: "Beer", value: "beer" },
  { label: "Brandy", value: "brandy" },
  { label: "Breezer", value: "breezer" },
  { label: "Vodka", value: "vodka" },
  { label: "Gin", value: "gin" },
  { label: "Rum", value: "rum" },
  { label: "Whisky", value: "whisky" },
  { label: "Wine", value: "wine" },
  { label: "Liquor", value: "liquor" },
  { label: "Tequila", value: "tequila" },
  { label: "Cocktail", value: "cocktail" },
];

function TabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 px-4 py-4 text-base font-medium transition ${
        active ? "text-gray-900" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      <span className="relative z-10">{label}</span>
      <span
        className={`absolute inset-x-0 bottom-0 h-[2px] transition ${
          active ? "bg-[#5a8c59]" : "bg-transparent"
        }`}
      />
    </button>
  );
}

function CategoryButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-base transition ${
        active
          ? "border-[#5a8c59] text-gray-900"
          : "border-transparent text-gray-700 hover:border-[#5a8c59]/50 hover:text-gray-900"
      }`}
    >
      {label}
    </button>
  );
}

function formatPrice(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return "0.00";
  }

  return numericValue.toFixed(2);
}

function MenuPopup({ item, loading, onClose }) {
  const [qty, setQty] = useState("1");
  const [remarks, setRemarks] = useState("Din");

  useEffect(() => {
    if (!item && !loading) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [item, loading, onClose]);

  if (!item && !loading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-6">
      <div className="relative w-full max-w-[980px] rounded-[24px] border border-stone-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-stone-400 bg-white text-xl text-stone-700 transition hover:text-black"
          aria-label="Close popup"
        >
          <FaTimes />
        </button>

        {loading ? (
          <div className="p-16 text-center text-stone-500">Loading item details...</div>
        ) : (
          <div className="grid gap-6 px-6 py-14 md:grid-cols-[190px_minmax(0,1fr)] md:px-10">
            <div className="flex items-center justify-center">
              <img
                src={`${BASEAPI}${item?.image || "default.jpg"}`}
                alt={item?.item_name || "Item"}
                className="max-h-32 w-auto object-contain"
              />
            </div>

            <div className="flex flex-col justify-center">
              <div className="grid gap-4 md:grid-cols-[1.25fr_0.65fr]">
                <div className="grid grid-cols-[100px_1fr] items-start gap-x-4 gap-y-2">
                  <div className="text-[18px] font-medium leading-6 text-stone-600">
                    Item
                    <br />
                    Name
                  </div>
                  <div className="pt-1 text-[18px] font-semibold text-stone-900">
                    {item?.item_name || "-"}
                  </div>

                  <div className="pt-3 text-[18px] font-medium text-stone-600">
                    A/C Unit
                  </div>
                  <div className="pt-2">
                    <select
                      value={item?.ac_unit || "Nos"}
                      disabled
                      className="h-12 w-full max-w-[110px] rounded-md border border-stone-300 bg-stone-50 px-4 text-[16px] text-stone-500 outline-none"
                    >
                      <option>{item?.ac_unit || "Nos"}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-[88px_1fr] items-start gap-x-4 gap-y-2">
                  <div className="pt-1 text-[18px] font-medium text-stone-600">
                    Price
                  </div>
                  <div className="pt-1 text-[18px] font-semibold text-stone-900">
                    {formatPrice(item?.unit_price)}
                  </div>

                  <div className="pt-3 text-[18px] font-medium text-stone-600">
                    Qty
                  </div>
                  <div className="pt-2">
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(event) => setQty(event.target.value)}
                      className="h-12 w-full max-w-[90px] rounded-md border border-stone-400 px-4 text-[16px] text-stone-800 outline-none"
                    />
                  </div>

                  <div className="pt-3 text-[18px] font-medium text-stone-600">
                    Remarks
                  </div>
                  <div className="pt-2">
                    <select
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      className="h-12 w-full max-w-[90px] rounded-md border border-stone-400 bg-white px-3 text-[16px] text-stone-800 outline-none"
                    >
                      <option value="Din">Din</option>
                      <option value="Take Away">Take Away</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  className="min-w-[185px] rounded-full border border-[#7ca23a] px-8 py-3 text-[18px] font-semibold text-[#6f9a2e] transition hover:bg-[#7ca23a]/5"
                >
                  Add to cart
                </button>
                <button
                  type="button"
                  className="min-w-[90px] rounded-full bg-[#5f8728] px-8 py-3 text-[18px] font-semibold text-white transition hover:brightness-105"
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-w-[150px] rounded-full border border-[#ff4b32] px-8 py-3 text-[18px] font-semibold text-[#ff4b32] transition hover:bg-red-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuGrid({ items, showStockStatus = false, onItemClick }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <button
          type="button"
          onClick={() => onItemClick?.(item)}
          key={item.item_id || item.item_code || `${item.item_name}-${index}`}
          className="group overflow-hidden rounded-[24px] border border-stone-200/80 bg-white text-left shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:border-[#5a8c59]/35 hover:shadow-[0_18px_38px_rgba(15,23,42,0.14)]"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#fff6ef] via-[#fffaf6] to-[#f7f7f7]">
            <img
              src={`${BASEAPI}${item.image || "default.jpg"}`}
              alt={item.item_name}
              className="h-full w-full object-contain p-6 transition duration-500 group-hover:scale-105"
            />
            {showStockStatus && item.stock_status && (
              <div className="absolute left-4 top-4 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 shadow-sm">
                {item.stock_status}
              </div>
            )}
          </div>

          <div className="space-y-2 p-4 sm:p-5">
            <div className="line-clamp-2 text-base font-semibold tracking-[0.01em] text-stone-900 sm:text-[17px]">
              {item.item_name}
            </div>
            {/* <div className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
              AFMC Menu
            </div> */}
          </div>
        </button>
      ))}
    </div>
  );
}

function FilterShell({ leftFilter, rightFilter, children }) {
  return (
    <div className="space-y-6 rounded-2xl bg-[#f5f5f5] p-5">
      <div className="grid gap-4 md:grid-cols-2">
        {leftFilter}
        {rightFilter}
      </div>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}) {
  const normalizedOptions = useMemo(
    () => Array.from(new Set(options.filter(Boolean))),
    [options]
  );

  return (
    <label className="block">
      <div className="mb-2 text-base font-medium text-gray-700">{label}</div>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition disabled:cursor-not-allowed disabled:bg-stone-100 focus:border-[#5a8c59] focus:ring-2 focus:ring-[#5a8c59]/20"
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnduserOtherSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/menubar`);
        const result = await response.json();
        console.log("1",result.data);

        setData(result.data || []);
      } catch (fetchError) {
        console.log("error", fetchError);
        setError(fetchError.message);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <FilterShell
      leftFilter={
        <SelectField
          label="Category"
          value=""
          onChange={() => {}}
          options={[]}
          placeholder="All Categories"
          disabled
        />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <MenuGrid items={visibleItems} onItemClick={onItemClick} />
    </FilterShell>
  );
}

function EnduserMocktailSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/fetchmocktail`);
        const result = await response.json();
        console.log("2",result.data);
        setData(result.data || []);
      } catch (fetchError) {
        console.log("error", fetchError);
        setError(fetchError.message);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <FilterShell
      leftFilter={
        <div className="hidden md:block" />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <MenuGrid items={visibleItems} onItemClick={onItemClick} />
    </FilterShell>
  );
}

function DrinkHardDrinkSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("beer");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/Drinkhard${category}`
        );
        const result = await response.json();
        console.log("3",result.data);
        setData(result.data || []);
      } catch (fetchError) {
        console.log("error", fetchError);
        setError(fetchError.message);
      }
    };

    fetchData();
  }, [category]);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="space-y-6 rounded-2xl bg-[#f5f5f5] p-5">
      <div className="flex flex-wrap gap-3">
        {hardDrinkCategories.map((item) => (
          <CategoryButton
            key={item.value}
            active={category === item.value}
            label={item.label}
            onClick={() => {
              setCategory(item.value);
              setSelectedItem("");
            }}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="hidden md:block" />
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      </div>

      <MenuGrid
        items={visibleItems}
        showStockStatus
        onItemClick={onItemClick}
      />
    </div>
  );
}

function SnackVegSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/Snacksveg`);
        const result = await response.json();
        console.log("4", result.data);
        console.log("4",result,"sai");
        setData(result.data || []);
      } catch (fetchError) {
        console.log("error", fetchError);
        setError(fetchError.message);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <FilterShell
      leftFilter={
        <div className="hidden md:block" />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <MenuGrid items={visibleItems} onItemClick={onItemClick} />
    </FilterShell>
  );
}

function SnackNonVegSection({ onItemClick }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/Snakcnonveg`);
        const result = await response.json();
        console.log("5",result.data);
        setData(result.data || []);
      } catch (fetchError) {
        console.log("error", fetchError);
        setError(fetchError.message);
      }
    };

    fetchData();
  }, []);

  const visibleItems = useMemo(() => {
    if (!selectedItem) {
      return data;
    }

    return data.filter((item) => item.item_name === selectedItem);
  }, [data, selectedItem]);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <FilterShell
      leftFilter={
        <div className="hidden md:block" />
      }
      rightFilter={
        <SelectField
          label="Item Name"
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          options={data.map((item) => item.item_name)}
          placeholder="Select Item"
        />
      }
    >
      <MenuGrid
        items={visibleItems}
        showStockStatus
        onItemClick={onItemClick}
      />
    </FilterShell>
  );
}

function MenuDashboard() {
  console.log("hello");
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("drinks");
  const [drinkSection, setDrinkSection] = useState("soft");
  const [snackSection, setSnackSection] = useState("veg");
  const [softDrinkCategory, setSoftDrinkCategory] = useState("Others");
  const [popupItem, setPopupItem] = useState(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupLoading, setPopupLoading] = useState(false);

  const handleItemClick = async (item) => {
    if (!item?.item_code || !item?.item_id) {
      return;
    }

    setPopupOpen(true);
    setPopupLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/memupopup?itemCode=${item.item_code}&itemId=${item.item_id}`
      );
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Failed to fetch popup details");
      }

      setPopupItem(result.data);
    } catch (error) {
      console.error("Popup fetch error:", error);
      setPopupItem({
        ...item,
        description: item.description || "",
        unit_price: item.unit_price || 0,
        ac_unit: item.ac_unit || "Nos",
        quantity: item.quantity || 0,
      });
    } finally {
      setPopupLoading(false);
    }
  };

  const closePopup = () => {
    setPopupOpen(false);
    setPopupItem(null);
    setPopupLoading(false);
  };

  const currentSectionKey = mainTab === "drinks" ? drinkSection : snackSection;
  const currentSection = useMemo(
    () => menuConfig[mainTab].sections[currentSectionKey],
    [currentSectionKey, mainTab]
  );

  const renderedContent = useMemo(() => {
    if (mainTab === "drinks" && drinkSection === "soft") {
      return softDrinkCategory === "Mocktail" ? (
        <EnduserMocktailSection onItemClick={handleItemClick} />
      ) : (
        <EnduserOtherSection onItemClick={handleItemClick} />
      );
    }

    if (mainTab === "drinks" && drinkSection === "hard") {
      return <DrinkHardDrinkSection onItemClick={handleItemClick} />;
    }

    if (mainTab === "snacks" && snackSection === "veg") {
      return <SnackVegSection onItemClick={handleItemClick} />;
    }

    return <SnackNonVegSection onItemClick={handleItemClick} />;
  }, [drinkSection, mainTab, snackSection, softDrinkCategory]);

  const handleMainTabChange = (tabKey) => {
    setMainTab(tabKey);

    if (tabKey === "drinks") {
      setDrinkSection("soft");
      setSoftDrinkCategory("Others");
      return;
    }

    setSnackSection("veg");
  };

  const handleDrinkSectionChange = (sectionKey) => {
    setDrinkSection(sectionKey);

    if (sectionKey === "soft") {
      setSoftDrinkCategory("Others");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-white px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full bg-[#7a6f66] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#655c55]"
          >
            <ChevronsLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white/80 shadow-[0_16px_40px_rgba(0,0,0,0.08)] backdrop-blur-sm">
          <div className="border-b border-stone-200/80">
            <div className="flex">
              {Object.entries(menuConfig).map(([tabKey, tab]) => (
                <TabButton
                  key={tabKey}
                  active={mainTab === tabKey}
                  label={tab.label}
                  onClick={() => handleMainTabChange(tabKey)}
                />
              ))}
            </div>
          </div>

          <div className="border-b border-stone-200/80">
            <div className="flex">
              {Object.entries(menuConfig[mainTab].sections).map(
                ([sectionKey, section]) => (
                  <TabButton
                    key={sectionKey}
                    active={currentSectionKey === sectionKey}
                    label={section.label}
                    onClick={() =>
                      mainTab === "drinks"
                        ? handleDrinkSectionChange(sectionKey)
                        : setSnackSection(sectionKey)
                    }
                  />
                )
              )}
            </div>
          </div>

          {currentSection.categories.length > 0 && (
            <div className="border-b border-stone-200/80 px-6 py-4">
              <div className="flex flex-wrap gap-3">
                {currentSection.categories.map((category) => (
                  <CategoryButton
                    key={category.key}
                    active={softDrinkCategory === category.key}
                    label={category.label}
                    onClick={() => setSoftDrinkCategory(category.key)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/60 p-2 md:p-4">{renderedContent}</div>
        </div>
      </div>

      {popupOpen && (
        <MenuPopup item={popupItem} loading={popupLoading} onClose={closePopup} />
      )}
    </div>
  );
}

export default MenuDashboard;
