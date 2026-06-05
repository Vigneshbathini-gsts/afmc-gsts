const OrderFilters = ({
    filters,
    setFilters,
    onSearch,
}) => {
    return (
        <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
            <input
                type="date"
                value={filters.fromDate}
                onChange={(e) =>
                    setFilters({
                        ...filters,
                        fromDate: e.target.value,
                    })
                }
                className="w-full border p-2 rounded"
            />

            <input
                type="date"
                value={filters.toDate}
                onChange={(e) =>
                    setFilters({
                        ...filters,
                        toDate: e.target.value,
                    })
                }
                className="w-full border p-2 rounded"
            />

            <input
                type="text"
                placeholder="Order Number"
                value={filters.orderNumber}
                onChange={(e) =>
                    setFilters({
                        ...filters,
                        orderNumber: e.target.value,
                    })
                }
                className="w-full border p-2 rounded"
            />

            <button
                onClick={onSearch}
                className="w-full rounded bg-black px-4 py-2 text-white transition hover:bg-gray-800"
            >
                Search
            </button>
        </div>
    );
};

export default OrderFilters;