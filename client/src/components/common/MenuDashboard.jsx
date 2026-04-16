import React, { useMemo, useState } from "react";
import { ChevronsLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import EnduserOther from "./ENDUSERFLOW/EnduserOther";
import EnduserMocktail from "./ENDUSERFLOW/EnduserMocktail";
import Drinkharddrink from "./ENDUSERFLOW/Drinkharddrink";
import Snackveg from "./ENDUSERFLOW/Snackveg";
import Snacknonveg from "./ENDUSERFLOW/Snacknonveg";

const menuConfig = {
  drinks: {
    label: "Drinks",
    sections: {
      soft: {
        label: "Soft Drinks",
        categories: [
          { key: "Others", label: "Others" },
          { key: "Mocktail", label: "Mocktail" },
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
        label: "Non Veg",
        categories: [],
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
        <EnduserMocktail />
      ) : (
        <EnduserOther />
      );
    }

    if (mainTab === "drinks" && drinkSection === "hard") {
      return <Drinkharddrink />;
    }

    if (mainTab === "snacks" && snackSection === "veg") {
      return <Snackveg />;
    }

    return <Snacknonveg />;
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

  const handleSnackSectionChange = (sectionKey) => {
    setSnackSection(sectionKey);
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
                        : handleSnackSectionChange(sectionKey)
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
