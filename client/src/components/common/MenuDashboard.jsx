import React, { useEffect, useMemo, useState } from "react";
import { ChevronsLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

function MenuGrid({ items, showStockStatus = false }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <div
          key={`${item.item_name}-${index}`}
          className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
        >
          <img
            src={`${BASEAPI}${item.image || "default.jpg"}`}
            alt={item.item_name}
            className="h-10 w-10 rounded-lg object-cover"
          />
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {item.item_name}
            </div>
            {showStockStatus && item.stock_status && (
              <div className="mt-1 text-xs font-medium text-red-600">
                {item.stock_status}
              </div>
            )}
          </div>
        </div>
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
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnduserOtherSection() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/menubar");
        const result = await response.json();
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
      <MenuGrid items={visibleItems} />
    </FilterShell>
  );
}

function EnduserMocktailSection() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/fetchmocktail");
        const result = await response.json();
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
      <MenuGrid items={visibleItems} />
    </FilterShell>
  );
}

function DrinkHardDrinkSection() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("beer");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/Drinkhard${category}`
        );
        const result = await response.json();
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

      <MenuGrid items={visibleItems} showStockStatus />
    </div>
  );
}

function SnackVegSection() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/Snacksveg");
        const result = await response.json();
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
      <MenuGrid items={visibleItems} />
    </FilterShell>
  );
}

function SnackNonVegSection() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/Snakcnonveg");
        const result = await response.json();
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
      <MenuGrid items={visibleItems} showStockStatus />
    </FilterShell>
  );
}

function MenuDashboard() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("drinks");
  const [drinkSection, setDrinkSection] = useState("soft");
  const [snackSection, setSnackSection] = useState("veg");
  const [softDrinkCategory, setSoftDrinkCategory] = useState("Others");

  const currentSectionKey = mainTab === "drinks" ? drinkSection : snackSection;
  const currentSection = useMemo(
    () => menuConfig[mainTab].sections[currentSectionKey],
    [currentSectionKey, mainTab]
  );

  const renderedContent = useMemo(() => {
    if (mainTab === "drinks" && drinkSection === "soft") {
      return softDrinkCategory === "Mocktail" ? (
        <EnduserMocktailSection />
      ) : (
        <EnduserOtherSection />
      );
    }

    if (mainTab === "drinks" && drinkSection === "hard") {
      return <DrinkHardDrinkSection />;
    }

    if (mainTab === "snacks" && snackSection === "veg") {
      return <SnackVegSection />;
    }

    return <SnackNonVegSection />;
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
    </div>
  );
}

export default MenuDashboard;
