const OrderFilters = ({
    filters,
    setFilters,
    onSearch,
}) => {
    return (
        <div className="grid grid-cols-5 gap-4 mb-6">
            <input
                type="date"
                value={filters.fromDate}
                onChange={(e) =>
                    setFilters({
                        ...filters,
                        fromDate: e.target.value,
                    })
                }
                className="border p-2 rounded"
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
                className="border p-2 rounded"
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
                className="border p-2 rounded"
            />

            <button
                onClick={onSearch}
                className="bg-black text-white rounded px-4"
            >
                Search
            </button>
        </div>
    );
};

export default OrderFilters;