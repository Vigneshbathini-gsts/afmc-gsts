import React, { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaSearch, FaTimes } from "react-icons/fa";
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

function GlassTabs({ options, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            active === option.key
              ? "bg-afmc-maroon text-white shadow-lg shadow-afmc-maroon/20"
              : "bg-white text-gray-700 ring-1 ring-afmc-gold/25 hover:bg-afmc-maroon/5 hover:text-afmc-maroon"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function formatPrice(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "0.00";
  }

  return numeric.toFixed(2);
}

function MenuCard({ item, showStockStatus = false, onSelect }) {
  const imageSrc = `${BASEAPI}${item.image || "default.jpg"}`;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      className="group overflow-hidden rounded-[28px] border border-afmc-gold/20 bg-white text-left shadow-[0_14px_40px_rgba(75,33,39,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(75,33,39,0.14)] focus:outline-none focus:ring-2 focus:ring-afmc-maroon2/30"
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2">
        <img
          src={imageSrc}
          alt={item.item_name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute left-4 top-4">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-afmc-maroon shadow-sm backdrop-blur-sm">
            AFMC Menu
          </span>
        </div>
        {showStockStatus && item.stock_status && (
          <span className="absolute right-4 top-4 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 shadow-sm">
            {item.stock_status}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="line-clamp-2 text-lg font-semibold text-white drop-shadow-sm md:text-xl">
            {item.item_name}
          </h3>
        </div>
      </div>
    </button>
  );
}

function ItemDetailsModal({ item, onClose }) {
  const [qty, setQty] = useState("1");
  const [remarks, setRemarks] = useState("Dining");

  useEffect(() => {
    if (!item) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  const imageSrc = `${BASEAPI}${item.image || "default.jpg"}`;
  const acUnit = item.ac_unit || item["A/C_UNIT"] || "Nos";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-afmc-gold/15 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.2)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 rounded-full border border-stone-200 bg-white p-2 text-stone-500 transition hover:text-afmc-maroon"
          aria-label="Close item details"
        >
          <FaTimes />
        </button>

        <div className="grid gap-8 p-6 md:grid-cols-[240px_minmax(0,1fr)] md:p-10">
          <div className="flex items-center justify-center rounded-[28px] bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2 p-6">
            <img
              src={imageSrc}
              alt={item.item_name}
              className="max-h-72 w-full object-contain"
            />
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-afmc-maroon/70">
                  Item Name
                </div>
                <h2 className="mt-2 text-3xl font-semibold text-stone-900">
                  {item.item_name}
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {item.description || "No description available for this item."}
                </p>
              </div>

              <div className="rounded-3xl bg-afmc-bg/65 p-5 text-center">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Price
                </div>
                <div className="mt-3 text-3xl font-bold text-afmc-maroon">
                  {formatPrice(item.unit_price)}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">
                  A/C Unit
                </span>
                <input
                  type="text"
                  value={acUnit}
                  readOnly
                  className="w-full rounded-2xl border border-afmc-gold/20 bg-stone-50 px-4 py-3 text-sm text-stone-700 outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">
                  Qty
                </span>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                  className="w-full rounded-2xl border border-afmc-gold/20 bg-white px-4 py-3 text-sm text-stone-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">
                  Remarks
                </span>
                <select
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  className="w-full rounded-2xl border border-afmc-gold/20 bg-white px-4 py-3 text-sm text-stone-800 outline-none transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
                >
                  <option value="Dining">Dining</option>
                  <option value="Take Away">Take Away</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 text-sm text-stone-600 md:grid-cols-2">
              <div className="rounded-2xl bg-stone-50 px-4 py-3">
                <span className="font-semibold text-stone-800">Item Code:</span>{" "}
                {item.item_code || "-"}
              </div>
              <div className="rounded-2xl bg-stone-50 px-4 py-3">
                <span className="font-semibold text-stone-800">Category ID:</span>{" "}
                {item.category_id || "-"}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-[#5c8b24] to-[#6aa02b] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6aa02b]/20 transition hover:brightness-105"
              >
                Add to cart
              </button>
              <button
                type="button"
                className="rounded-full border border-[#6aa02b] px-8 py-3 text-sm font-semibold text-[#5c8b24] transition hover:bg-[#6aa02b]/5"
              >
                Buy
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-red-300 px-8 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  search,
  setSearch,
  selectedItem,
  setSelectedItem,
  itemOptions,
  placeholder = "Search item name",
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">Search</span>
        <div className="flex items-center gap-3 rounded-2xl border border-afmc-gold/20 bg-white px-4 py-3 shadow-sm">
          <FaSearch className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">Item Name</span>
        <select
          value={selectedItem}
          onChange={(event) => setSelectedItem(event.target.value)}
          className="w-full rounded-2xl border border-afmc-gold/20 bg-white px-4 py-3 text-sm text-gray-800 outline-none shadow-sm transition focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20"
        >
          <option value="">All Items</option>
          {itemOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function useMenuData(endpoint) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
        const result = await response.json();
        if (!cancelled) {
          setData(result.data || []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || "Failed to load menu items.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return { data, loading, error };
}

function MenuSection({
  endpoint,
  showStockStatus = false,
  emptyMessage,
  extraFilter,
  onSelectItem,
}) {
  const { data, loading, error } = useMenuData(endpoint);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  const itemOptions = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .map((item) => String(item.item_name || "").trim())
            .filter(Boolean)
        )
      ),
    [data]
  );

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesItem = selectedItem ? item.item_name === selectedItem : true;
      const matchesSearch = query
        ? String(item.item_name || "").toLowerCase().includes(query)
        : true;
      const matchesExtra = extraFilter ? extraFilter(item) : true;
      return matchesItem && matchesSearch && matchesExtra;
    });
  }, [data, extraFilter, search, selectedItem]);

  if (loading) {
    return <div className="py-10 text-center text-gray-500">Loading menu items...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FilterBar
        search={search}
        setSearch={setSearch}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        itemOptions={itemOptions}
      />

      {visibleItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-afmc-gold/35 bg-afmc-bg/60 px-6 py-12 text-center text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleItems.map((item, index) => (
            <MenuCard
              key={`${item.item_name}-${index}`}
              item={item}
              showStockStatus={showStockStatus}
              onSelect={onSelectItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HardDrinkSection({ onSelectItem }) {
  const [selectedCategory, setSelectedCategory] = useState("beer");
  const endpointMap = {
    beer: "menubar",
    brandy: "fetchbrandy",
    breezer: "fetchbreezer",
    vodka: "fetchVodka",
    gin: "fetchgin",
    rum: "fetchrum",
    whisky: "fetchwiskey",
    wine: "fetchwine",
    liquor: "fetchliquor",
    tequila: "fetchtequila",
    cocktail: "fetchcocktail",
  };

  return (
    <div className="space-y-6">
      <GlassTabs
        options={hardDrinkCategories.map((item) => ({
          key: item.value,
          label: item.label,
        }))}
        active={selectedCategory}
        onChange={setSelectedCategory}
      />

      <MenuSection
        endpoint={endpointMap[selectedCategory]}
        emptyMessage="No drinks found for this category."
        onSelectItem={onSelectItem}
      />
    </div>
  );
}

export default function AttendantMenuDashboard() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("drinks");
  const [drinkSection, setDrinkSection] = useState("soft");
  const [snackSection, setSnackSection] = useState("veg");
  const [softDrinkCategory, setSoftDrinkCategory] = useState("Others");
  const [selectedItemDetails, setSelectedItemDetails] = useState(null);

  const currentSectionKey = mainTab === "drinks" ? drinkSection : snackSection;
  const currentSection = useMemo(
    () => menuConfig[mainTab].sections[currentSectionKey],
    [currentSectionKey, mainTab]
  );

  const content = useMemo(() => {
    if (mainTab === "drinks" && drinkSection === "soft") {
      return (
        <MenuSection
          endpoint={softDrinkCategory === "Mocktail" ? "fetchmocktail" : "menubar"}
          emptyMessage="No soft drinks found."
          onSelectItem={setSelectedItemDetails}
        />
      );
    }

    if (mainTab === "drinks" && drinkSection === "hard") {
      return <HardDrinkSection onSelectItem={setSelectedItemDetails} />;
    }

    if (mainTab === "snacks" && snackSection === "veg") {
      return (
        <MenuSection
          endpoint="snakcveg"
          emptyMessage="No veg snacks found."
          onSelectItem={setSelectedItemDetails}
        />
      );
    }

    return (
      <MenuSection
        endpoint="Snakcnonveg"
        showStockStatus
        emptyMessage="No non-veg snacks found."
        onSelectItem={setSelectedItemDetails}
      />
    );
  }, [drinkSection, mainTab, snackSection, softDrinkCategory]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-afmc-bg via-white to-afmc-bg2">
      <div className="absolute left-12 top-16 h-72 w-72 rounded-full bg-afmc-maroon/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-afmc-maroon2/10 blur-3xl" />

      <div className="relative z-10 p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between md:mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-afmc-maroon">
              Attendant Menu Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Premium menu cards with the admin inventory theme.
            </p>
          </div>

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

          <div className="space-y-5">
            <GlassTabs
              options={Object.entries(menuConfig).map(([key, value]) => ({
                key,
                label: value.label,
              }))}
              active={mainTab}
              onChange={(tab) => {
                setMainTab(tab);
                if (tab === "drinks") {
                  setDrinkSection("soft");
                  setSoftDrinkCategory("Others");
                } else {
                  setSnackSection("veg");
                }
              }}
            />

            <GlassTabs
              options={Object.entries(menuConfig[mainTab].sections).map(
                ([key, value]) => ({
                  key,
                  label: value.label,
                })
              )}
              active={currentSectionKey}
              onChange={(key) => {
                if (mainTab === "drinks") {
                  setDrinkSection(key);
                  if (key === "soft") {
                    setSoftDrinkCategory("Others");
                  }
                } else {
                  setSnackSection(key);
                }
              }}
            />

            {currentSection.categories.length > 0 && (
              <div className="rounded-2xl bg-afmc-bg/60 p-3">
                <GlassTabs
                  options={currentSection.categories}
                  active={softDrinkCategory}
                  onChange={setSoftDrinkCategory}
                />
              </div>
            )}
          </div>

          <div className="mt-8 rounded-[28px] bg-gradient-to-b from-white to-afmc-bg/40 p-4 md:p-5">
            {content}
          </div>
        </div>
      </div>

      <ItemDetailsModal
        item={selectedItemDetails}
        onClose={() => setSelectedItemDetails(null)}
      />
    </div>
  );
}
