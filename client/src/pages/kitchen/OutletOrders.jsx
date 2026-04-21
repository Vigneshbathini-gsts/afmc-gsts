import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FaTimesCircle,
  FaSpinner,
  FaSearch,
  FaChevronLeft,
  FaChevronRight,
  FaUtensils,
  FaCocktail,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { barOrdersAPI } from "../../services/api";

/* THEME */
const MAROON = "#6B1A4F";
const MAROON2 = "#7B2252";
const GOLD = "#DAA520";

export default function OutletOrders({ kitchenType = "Bar" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();
  const rowsPerPage = 8;

  const isKitchen = kitchenType === "Kitchen";
  const title = isKitchen ? "Kitchen Orders" : "Bar Orders";
  const description = isKitchen
    ? "View and manage food-related orders"
    : "View and manage liquor-related orders";

  const icon = isKitchen ? <FaUtensils /> : <FaCocktail />;

  /* FETCH */
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await barOrdersAPI.getOrders(kitchenType);
      console.log("Fetched orders:", res.data);
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [kitchenType]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  /* FILTER */
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const search = searchTerm.toLowerCase();
      return (
        String(o.ORDERNUMBER).toLowerCase().includes(search) ||
        String(o.FIRST_NAME).toLowerCase().includes(search) ||
        String(o.STATUS).toLowerCase().includes(search)
      );
    });
  }, [orders, searchTerm]);

  /* PAGINATION */
  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredOrders.slice(start, start + rowsPerPage);
  }, [filteredOrders, currentPage]);

  useEffect(() => setCurrentPage(1), [searchTerm]);

  /* HANDLERS */
  const handleOrderClick = async (order) => {
    if (order.CAN_NAVIGATE !== "Y") return;

    try {
      let updated = { ...order };

      if (order.Status1 === "Received") {
        await barOrdersAPI.updateStatus({
          ORDERNUMBER: order.ORDERNUMBER,
          KITCHEN: kitchenType,
        });

        updated.Status1 = "Preparing";
        updated.STATUS = "Preparing";
      }

      navigate("../order-details", {
        state: { ...updated, kitchenType },
      });
    } catch (err) {
      alert("Failed to open order");
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "Received":
        return {
          background: "#fff8e6",
          color: "#b8860b",
          border: "1px solid #f0d98a",
        };
      case "Preparing":
        return {
          background: "#fbe9f0",
          color: MAROON2,
          border: "1px solid #e3b6c8",
        };
      case "Completed":
        return {
          background: "#eaf7f0",
          color: "#1e7e34",
          border: "1px solid #b7e4c7",
        };
      default:
        return {
          background: "#f4f4f4",
          color: "#666",
        };
    }
  };

  return (
    <div style={{ padding: 24 }}>
      
      {/* HEADER */}
      <div
        style={{
          background: `linear-gradient(135deg, ${MAROON}, ${MAROON2})`,
          borderRadius: 16,
          padding: "16px 20px",
          color: "#fff",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              padding: 10,
              borderRadius: 10,
              color: GOLD,
              fontSize: 18,
            }}
          >
            {icon}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* CARD */}
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 8px 30px rgba(107,26,79,0.08)",
          border: "1px solid rgba(107,26,79,0.1)",
        }}
      >
        {/* TOP BAR */}
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Orders List</h3>
            <p style={{ fontSize: 12, color: "#777" }}>
              Active and completed orders
            </p>
          </div>

          <div style={{ position: "relative", width: 260 }}>
            <FaSearch
              style={{
                position: "absolute",
                top: "50%",
                left: 10,
                transform: "translateY(-50%)",
                color: "#aaa",
              }}
            />
            <input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 10px 10px 32px",
                borderRadius: 10,
                border: "1px solid rgba(107,26,79,0.2)",
              }}
            />
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <FaSpinner className="spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            No orders found
          </div>
        ) : (
          <>
            <table style={{ width: "100%", fontSize: 14 }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={th}>Order No</th>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Date</th>
                  <th style={th}>Bar</th>
                  <th style={th}>Kitchen</th>
                  <th style={th}>Cancel</th>
                </tr>
              </thead>

              <tbody>
                {paginatedOrders.map((o, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                    <td style={td}>
                      <span
                        onClick={() => handleOrderClick(o)}
                        style={{
                          color: MAROON,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {o.ORDERNUMBER}
                      </span>
                    </td>

                    <td style={td}>{o.FIRST_NAME}</td>

                    <td style={td}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          ...getStatusStyle(o.STATUS),
                        }}
                      >
                        {o.STATUS}
                      </span>
                    </td>

                    <td style={td}>{o.CREATION_DATE}</td>
                    <td style={td}>{o.Handled_by_bar}</td>
                    <td style={td}>{o.Handled_by_kitchen}</td>

                    <td style={{ ...td, textAlign: "center" }}>
                      <FaTimesCircle
                        style={{
                          color:
                            o.CAN_CANCEL === "Y" ? "#e74c3c" : "#ccc",
                          cursor:
                            o.CAN_CANCEL === "Y"
                              ? "pointer"
                              : "not-allowed",
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div
              style={{
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #eee",
              }}
            >
              <span style={{ fontSize: 12 }}>
                Page {currentPage} of {totalPages || 1}
              </span>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setCurrentPage((p) => p - 1)}>
                  <FaChevronLeft />
                </button>

                <button onClick={() => setCurrentPage((p) => p + 1)}>
                  <FaChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* TABLE STYLES */
const th = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 12,
  color: "#666",
};

const td = {
  padding: "12px 16px",
};