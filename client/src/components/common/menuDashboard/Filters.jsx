import React from "react";

function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
        {label}
      </span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/20"
      />
    </label>
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
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600">
        {label}
      </span>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm outline-none transition focus:border-afmc-maroon focus:ring-2 focus:ring-afmc-maroon/20 disabled:cursor-not-allowed disabled:bg-gray-50"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function FilterBlock({
  itemOptions,
  selectedItem,
  onSelectedItem,
  search,
  onSearch,
  rightLabel = "Item Name",
  showSearch = true,
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {showSearch ? (
        <div className="space-y-2">
          <TextField
            label="Search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search items..."
          />
          {(search || selectedItem) ? (
            <button
              type="button"
              onClick={() => {
                onSearch("");
                onSelectedItem("");
              }}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:border-afmc-maroon/30 hover:text-afmc-maroon"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="hidden md:block" />
      )}

      <SelectField
        label={rightLabel}
        value={selectedItem}
        onChange={(event) => onSelectedItem(event.target.value)}
        options={itemOptions}
        placeholder="Select Item"
      />
    </div>
  );
}

