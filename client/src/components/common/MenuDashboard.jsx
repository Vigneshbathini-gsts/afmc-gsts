import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronsLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const menuConfig = {
  drinks: {
    label: "Drinks",
    sections: {
      soft: {
        label: "Soft Drinks",
        filterLabel: "Category",
        categories: ["Others", "Mocktail"],
        items: [
          { name: "COKE 2250 ML", category: "Others", accent: "from-red-200 to-red-50" },
          { name: "SPRITE 2250 ML", category: "Others", accent: "from-green-200 to-green-50" },
          { name: "COKE 250 ML", category: "Others", accent: "from-amber-200 to-yellow-50" },
          { name: "SPRITE 250 ML", category: "Others", accent: "from-lime-200 to-lime-50" },
          { name: "REAL GUAVA 1000 ML", category: "Mocktail", accent: "from-orange-200 to-orange-50" },
          { name: "REAL LITCHI 1000 ML", category: "Mocktail", accent: "from-fuchsia-200 to-rose-50" },
          { name: "REAL MIXED FRUIT 1000 ML", category: "Mocktail", accent: "from-amber-200 to-rose-50" },
          { name: "REAL CRANBERRY 1000 ML", category: "Mocktail", accent: "from-pink-200 to-rose-50" },
          { name: "REAL PINEAPPLE 1000 ML", category: "Mocktail", accent: "from-yellow-200 to-amber-50" },
          { name: "REAL ORANGE 1000 ML", category: "Mocktail", accent: "from-orange-300 to-orange-50" },
          { name: "REAL GUAVA 180 ML", category: "Mocktail", accent: "from-orange-200 to-yellow-50" },
          { name: "REAL LITCHI 180 ML", category: "Mocktail", accent: "from-fuchsia-200 to-pink-50" },
        ],
      },
      hard: {
        label: "Hard Drinks",
        filterLabel: "Item Name",
        categories: [
          "Beer",
          "Brandy",
          "Breezer",
          "Vodka",
          "Gin",
          "Rum",
          "Whisky",
          "Wine",
          "Liquor",
          "Tequila",
          "Cocktail",
        ],
        items: [
          { name: "BIRA WHITE", category: "Beer", accent: "from-orange-200 to-amber-50" },
          { name: "BIRA DRAUGHT", category: "Beer", accent: "from-violet-200 to-violet-50" },
          { name: "BUDWEISER MAGNUM", category: "Beer", accent: "from-yellow-200 to-amber-50" },
          { name: "BUDWEISER PREMIUM", category: "Beer", accent: "from-stone-200 to-stone-50" },
          { name: "CORONA", category: "Beer", accent: "from-yellow-100 to-yellow-50" },
          { name: "KING FISHER STRONG", category: "Beer", accent: "from-red-200 to-red-50" },
          { name: "KING FISHER PREMIUM", category: "Beer", accent: "from-green-200 to-green-50" },
          { name: "WHITE HOEGAARDEN", category: "Beer", accent: "from-amber-100 to-orange-50" },
          { name: "CARLSBERG CAN", category: "Beer", accent: "from-zinc-200 to-zinc-50" },
          { name: "CARLSBERG BOTT 650", category: "Beer", accent: "from-lime-200 to-green-50" },
          { name: "CORONA EXTRA BEER", category: "Beer", accent: "from-yellow-200 to-amber-50" },
          { name: "HEINEKEN", category: "Beer", accent: "from-emerald-200 to-emerald-50" },
        ],
      },
    },
  },
  snacks: {
    label: "Snacks",
    sections: {
      veg: {
        label: "Veg",
        filterLabel: "Item Name",
        categories: [],
        items: [
          { name: "PEANUTS 90 GM", accent: "from-yellow-200 to-yellow-50" },
          { name: "WAFERS 25 GM", accent: "from-pink-200 to-pink-50" },
          { name: "CHEESE CORN NUGGETS 400 GM", accent: "from-orange-200 to-yellow-50" },
          { name: "FRENCH FRIES 425 GM", accent: "from-amber-200 to-amber-50" },
          { name: "MASALA NUGGETS 400 GM", accent: "from-yellow-300 to-yellow-50" },
          { name: "PANEER POPS 360 GM", accent: "from-blue-200 to-blue-50" },
          { name: "MASALA FRENCH FRIES 420 GM", accent: "from-orange-200 to-amber-50" },
          { name: "POTATO BITES 420 GM", accent: "from-red-200 to-orange-50" },
          { name: "SMILEY 415 GM", accent: "from-yellow-200 to-yellow-50" },
          { name: "VEGGIE FINGER 400 GMS", accent: "from-lime-200 to-green-50" },
          { name: "CHEESE POTATO SHOTS 400 GM", accent: "from-yellow-200 to-orange-50" },
          { name: "CHEESE PIZZA FINGER", accent: "from-orange-200 to-red-50" },
        ],
      },
      nonVeg: {
        label: "Non Veg",
        filterLabel: "Item Name",
        categories: [],
        items: [
          { name: "CHICKEN AFGHANI SEEKH KABAB 360 GM", accent: "from-orange-200 to-yellow-50" },
          { name: "CHICKEN CRISPY BITES 360 GM", accent: "from-lime-200 to-lime-50" },
          { name: "CHICKEN LUCKNOW SEEKH KABAB 400 GM", accent: "from-yellow-200 to-orange-50", outOfStock: true },
          { name: "CHICKEN ROYAL CHEESE NUGGETS 325 GM", accent: "from-red-200 to-pink-50" },
          { name: "CHICKEN CHEESE & ONION SAUSAGES 250 GM", accent: "from-amber-200 to-yellow-50" },
          { name: "CHICKEN NUGGETS 200 GM", accent: "from-orange-200 to-orange-50" },
          { name: "CHICKEN PUNJABI TIKKA 360 GM", accent: "from-stone-200 to-orange-50" },
          { name: "FISH FINGER 200 GM", accent: "from-yellow-100 to-yellow-50" },
          { name: "CRAB CLAW 250 GM", accent: "from-slate-200 to-slate-50" },
          { name: "TEST_PK", accent: "from-zinc-200 to-zinc-50", outOfStock: true },
          { name: "CHIPS", accent: "from-lime-200 to-lime-50" },
        ],
      },
    },
  },
};

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

function ItemCard({ item }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white/95 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.accent}`}
        >
          <span className="text-sm font-bold text-gray-700">
            {item.name.charAt(0)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-tight text-gray-900">
            {item.name}
          </p>
          {item.outOfStock && (
            <p className="mt-2 text-sm font-semibold text-red-600">Out Of Stock</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuDashboard() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("drinks");
  const [drinkSection, setDrinkSection] = useState("soft");
  const [snackSection, setSnackSection] = useState("veg");
  const [activeCategory, setActiveCategory] = useState("Others");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchItem, setSearchItem] = useState("");

  const currentSectionKey = mainTab === "drinks" ? drinkSection : snackSection;
  const currentSection = menuConfig[mainTab].sections[currentSectionKey];

  const visibleItems = useMemo(() => {
    return currentSection.items.filter((item) => {
      const categoryMatch =
        !currentSection.categories.length ||
        !activeCategory ||
        item.category === activeCategory;

      const dropdownCategoryMatch =
        !selectedCategory || item.category === selectedCategory;

      const nameMatch = item.name
        .toLowerCase()
        .includes(searchItem.trim().toLowerCase());

      return categoryMatch && dropdownCategoryMatch && nameMatch;
    });
  }, [activeCategory, currentSection, searchItem, selectedCategory]);

  const handleMainTabChange = (tabKey) => {
    setMainTab(tabKey);
    setSearchItem("");
    setSelectedCategory("");

    if (tabKey === "drinks") {
      setActiveCategory("Others");
    } else {
      setActiveCategory("");
    }
  };

  const handleDrinkSectionChange = (sectionKey) => {
    setDrinkSection(sectionKey);
    setSearchItem("");
    setSelectedCategory("");
    setActiveCategory(sectionKey === "soft" ? "Others" : "Beer");
  };

  const handleSnackSectionChange = (sectionKey) => {
    setSnackSection(sectionKey);
    setSearchItem("");
    setSelectedCategory("");
    setActiveCategory("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-rose-50 to-white px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full bg-stone-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-600"
          >
            <ChevronsLeft size={16} />
            Back
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/55 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.08)] backdrop-blur-sm md:p-6">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[80%] w-[34%] rounded-[36px] bg-gradient-to-b from-[#d8c3a5]/12 to-[#8d6e63]/6 blur-[1px]" />
          </div>

          <div className="relative z-10 space-y-5">
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/90 shadow-md">
              <div className="grid grid-cols-2">
                <TabButton
                  active={mainTab === "drinks"}
                  label="Drinks"
                  onClick={() => handleMainTabChange("drinks")}
                />
                <TabButton
                  active={mainTab === "snacks"}
                  label="Snacks"
                  onClick={() => handleMainTabChange("snacks")}
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/90 shadow-md">
              <div className="grid grid-cols-2">
                {mainTab === "drinks" ? (
                  <>
                    <TabButton
                      active={drinkSection === "soft"}
                      label="Soft Drinks"
                      onClick={() => handleDrinkSectionChange("soft")}
                    />
                    <TabButton
                      active={drinkSection === "hard"}
                      label="Hard Drinks"
                      onClick={() => handleDrinkSectionChange("hard")}
                    />
                  </>
                ) : (
                  <>
                    <TabButton
                      active={snackSection === "veg"}
                      label="Veg"
                      onClick={() => handleSnackSectionChange("veg")}
                    />
                    <TabButton
                      active={snackSection === "nonVeg"}
                      label="Non Veg"
                      onClick={() => handleSnackSectionChange("nonVeg")}
                    />
                  </>
                )}
              </div>
            </div>

            {currentSection.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-stone-300">
                {currentSection.categories.map((category) => (
                  <CategoryButton
                    key={category}
                    active={activeCategory === category}
                    label={category}
                    onClick={() => {
                      setActiveCategory(category);
                      setSelectedCategory(category);
                    }}
                  />
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-stone-200 bg-white/88 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.06)] md:p-6">
              <div
                className={`mb-6 grid gap-4 ${
                  currentSection.categories.length > 0
                    ? "md:grid-cols-[160px_minmax(220px,320px)_160px_minmax(220px,320px)]"
                    : "md:grid-cols-[160px_minmax(220px,320px)]"
                }`}
              >
                {currentSection.categories.length > 0 && (
                  <>
                    <label className="flex items-center justify-center text-2xl font-medium text-slate-600 md:justify-end">
                      {currentSection.filterLabel}
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCategory}
                        onChange={(event) => {
                          setSelectedCategory(event.target.value);
                          setActiveCategory(event.target.value);
                        }}
                        className="h-14 w-full appearance-none rounded-md border border-stone-400 bg-white px-4 pr-12 text-base text-gray-800 outline-none transition focus:border-[#5a8c59] focus:ring-2 focus:ring-[#5a8c59]/20"
                      >
                        <option value="">All Categories</option>
                        {currentSection.categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    </div>
                  </>
                )}

                <label className="flex items-center justify-center text-2xl font-medium text-slate-600 md:justify-end">
                  Item Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchItem}
                    onChange={(event) => setSearchItem(event.target.value)}
                    className="h-14 w-full rounded-md border border-stone-400 bg-white px-4 pr-12 text-base text-gray-800 outline-none transition focus:border-[#5a8c59] focus:ring-2 focus:ring-[#5a8c59]/20"
                  />
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto pr-1">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {visibleItems.map((item) => (
                    <ItemCard key={item.name} item={item} />
                  ))}
                </div>

                {visibleItems.length === 0 && (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center text-sm text-stone-500">
                    No items found for the selected filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuDashboard;
