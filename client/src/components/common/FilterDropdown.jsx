import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown, FaSearch } from "react-icons/fa";

export default function FilterDropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
  allLabel = "All",
  disabled = false,
  loading = false,
  loadingLabel = "Loading...",
  formatLabel = (v) => v,
  buttonClassName = "",
  menuClassName = "",
  labelClassName = "",
  valueClassName = "",
  usePortal = false,
  onMenuScroll,
  onSearchChange,
  hasMore = false,
  loadingMore = false,
  menuWidth = null,
  // Controlled search value (optional). When provided, the dropdown will
  // initialize and keep the search input in sync with this value while open.
  searchValue = undefined,
}) {
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdownContains = dropdownRef.current?.contains(event.target);
      const menuContains = usePortal && menuRef.current?.contains(event.target);

      if (!dropdownContains && !menuContains) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [usePortal]);

  // When the menu opens, initialize the internal query from the externally
  // provided `searchValue` (if any). Also keep the query in sync while the
  // menu is open so external callers can control the search term.
  useEffect(() => {
    if (isOpen) {
      if (typeof searchValue === "string") {
        setQuery(searchValue);
      }
      return;
    }

    // Do not clear the query on close so callers can preserve the last
    // search term across openings if they wish. This avoids surprising
    // resets when switching between multiple dropdowns.
  }, [isOpen, searchValue]);

  // If the external searchValue changes while the menu is open, reflect it.
  useEffect(() => {
    if (isOpen && typeof searchValue === "string") {
      setQuery(searchValue);
    }
  }, [searchValue, isOpen]);

  const cleanedOptions = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    return list
      .map((opt) => {
        if (typeof opt === "string" || typeof opt === "number") {
          const str = String(opt).trim();
          if (!str) return null;
          return { value: str, label: str };
        }

        if (opt && typeof opt === "object") {
          const rawValue = opt.value ?? opt.id ?? opt.key ?? "";
          const rawLabel = opt.label ?? opt.name ?? opt.title ?? rawValue;
          const strValue = String(rawValue ?? "").trim();
          const strLabel = String(rawLabel ?? "").trim();
          if (!strValue || !strLabel) return null;
          return { value: strValue, label: strLabel };
        }

        return null;
      })
      .filter(Boolean);
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cleanedOptions;
    return cleanedOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [cleanedOptions, query]);

  useEffect(() => {
    if (!isOpen) return;
    // Focus the search box without letting the browser auto-scroll the
    // page to bring it into view (that scroll is what was causing the
    // whole UI to jump when the dropdown opened / while typing).
    const t = setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !usePortal) {
      setMenuPosition(null);
      return;
    }

    const update = () => {
      const buttonEl = buttonRef.current;
      if (!buttonEl) return;
      const rect = buttonEl.getBoundingClientRect();
      const menuHeight =
        menuRef.current?.offsetHeight != null ? menuRef.current.offsetHeight : 0;
      const safeGap = 8;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const shouldFlip =
        menuHeight > 0 && spaceBelow < menuHeight && spaceAbove > spaceBelow;

      let top = shouldFlip
        ? rect.top - safeGap - menuHeight
        : rect.bottom + safeGap;

      top = Math.max(safeGap, Math.min(top, window.innerHeight - safeGap));

      const resolvedWidth =
        menuWidth != null
          ? typeof menuWidth === "number"
            ? `${menuWidth}px`
            : menuWidth
          : rect.width;

      setMenuPosition({
        left: rect.left,
        top,
        width: resolvedWidth,
      });
    };

    // Measure synchronously before the browser paints, so the menu never
    // flashes at (0,0) with an "auto" width before snapping into place.
    update();

    window.addEventListener("resize", update);
    // Capture scrolls from any scroll container.
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // Re-measure on resize/scroll only — the menu now has a fixed height,
    // so it never needs repositioning just because you typed a character.
  }, [isOpen, usePortal, menuWidth]);

  const selectedValue = value ? String(value) : "";
  const selectedOption = cleanedOptions.find(
    (opt) => String(opt.value) === String(selectedValue)
  );
  const buttonLabel = selectedOption
    ? formatLabel(selectedOption.label)
    : (selectedValue ? formatLabel(selectedValue) : placeholder);

  const menuEl = (
    <div
      ref={menuRef}
      className={`${usePortal
          ? "rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
          : "absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        } ${menuClassName}`}
      style={
        usePortal
          ? {
            position: "fixed",
            left: menuPosition?.left ?? 0,
            top: menuPosition?.top ?? 0,
            width:
              menuPosition?.width ??
              (menuWidth != null
                ? typeof menuWidth === "number"
                  ? `${menuWidth}px`
                  : menuWidth
                : "auto"),
            zIndex: 9999,
            opacity: menuPosition ? 1 : 0,
            visibility: menuPosition ? "visible" : "hidden",
            transition: "opacity 120ms ease-out",
          }
          : undefined
      }
    >
      <div className="border-b border-gray-100 p-3">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <FaSearch className="text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              const nextQuery = e.target.value;
              setQuery(nextQuery);
              onSearchChange?.(nextQuery);
            }}
            placeholder="Search"
            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <div
        className="h-60 overflow-y-auto py-2"
        onScroll={(event) => {
          const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
          if (
            onMenuScroll &&
            hasMore &&
            !loadingMore &&
            scrollTop + clientHeight >= scrollHeight - 40
          ) {
            onMenuScroll(event);
          }
        }}
      >
        <button
          type="button"
          onClick={() => {
            // Clear internal query so the search box is emptied
            setQuery("");
            // Notify parent so it can reload the unfiltered option list
            onSearchChange?.("");
            // Clear selection
            onChange?.("");
            setIsOpen(false);
          }}
          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${!selectedValue
              ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
              : "text-gray-700"
            }`}
        >
          {allLabel}
        </button>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            {loadingLabel}
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-500">
            No matching options found.
          </div>
        ) : (
          filteredOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange?.(opt.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-afmc-maroon2/5 ${String(selectedValue) === String(opt.value)
                  ? "bg-afmc-maroon2/10 font-medium text-afmc-maroon"
                  : "text-gray-700"
                }`}
            >
              <span className="capitalize">{formatLabel(opt.label)}</span>
            </button>
          ))
        )}
        {loadingMore && (
          <div className="px-4 py-3 text-sm text-gray-500">
            Loading more...
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {label ? (
        <label
          className={`block text-sm font-medium text-gray-700 mb-2 ${labelClassName}`}
        >
          {label}
        </label>
      ) : null}

      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-gray-800 focus:border-afmc-maroon2 focus:ring-2 focus:ring-afmc-maroon2/20 flex items-center justify-between disabled:opacity-60 disabled:cursor-not-allowed ${buttonClassName}`}
        >
          <span className="capitalize truncate">
            {buttonLabel}
          </span>
          <FaChevronDown
            className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""
              }`}
          />
        </button>

        {isOpen && !disabled && (
          usePortal ? createPortal(menuEl, document.body) : menuEl
        )}
      </div>
    </div>
  );
}