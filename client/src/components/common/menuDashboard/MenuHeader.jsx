import React from "react";
import { ChevronsLeft } from "lucide-react";

export default function MenuHeader({ onBack }) {
  return (
    <div className="border-b border-gray-300 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
            <p className="mt-0.5 text-xs text-gray-600">Select items to add to cart</p>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-100"
          >
            <ChevronsLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

