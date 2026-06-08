import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { API_BASE_URL, barOrdersAPI } from "../../services/api";
import { toInitCap } from "../../utils/textFormat";
import {formatDisplayDate} from "../../utils/dateUtils";

/* THEME */
const MAROON = "#6B1A4F";
const MAROON2 = "#7B2252";
const GOLD = "#DAA520";

export default function OutletOrders({ kitchenType = "Bar" }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingOrder, setCancellingOrder] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const knownOrderKeysRef = useRef(new Set());
  const hasLoadedOrdersRef = useRef(false);
  const audioContextRef = useRef(null);
  const skipNextDetectedSoundRef = useRef(false);

  const navigate = useNavigate();
  const rowsPerPage = 8;

  const isKitchen = kitchenType === "Kitchen";
  const title = isKitchen ? "Kitchen Orders" : "Bar Orders";
  const description = isKitchen
    ? "View and manage food-related orders"
    : "View and manage liquor-related orders";

  const icon = isKitchen ? <FaUtensils /> : <FaCocktail />;

  const playNewOrderSound = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;

      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }

      const now = context.currentTime;
      const tones = [880, 1174];

      tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * 0.18;
        const end = start + 0.14;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      });
    } catch (error) {
      console.warn("Unable to play new order notification sound:", error);
    }
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const context = audioContextRef.current || new AudioContext();
        audioContextRef.current = context;
        if (context.state === "suspended") {
          context.resume().catch(() => {});
        }
      } catch {
        // Browser audio unlock can fail silently until a later interaction.
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  /* FETCH */
  const fetchOrders = useCallback(async ({ silent = false, playOnNew = true } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await barOrdersAPI.getOrders(kitchenType);
      const nextOrders = res.data || [];
      const nextOrderKeys = new Set(
        nextOrders
          .map((order) => String(order?.ORDERNUMBER || "").trim())
          .filter(Boolean)
      );
      const hasNewOrder =
        hasLoadedOrdersRef.current &&
        [...nextOrderKeys].some((orderKey) => !knownOrderKeysRef.current.has(orderKey));

      knownOrderKeysRef.current = nextOrderKeys;
      hasLoadedOrdersRef.current = true;
      setOrders(nextOrders);

      if (hasNewOrder && playOnNew && !skipNextDetectedSoundRef.current) {
        playNewOrderSound();
      }
      skipNextDetectedSoundRef.current = false;
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [kitchenType, playNewOrderSound]);

  useEffect(() => {
    knownOrderKeysRef.current = new Set();
    hasLoadedOrdersRef.current = false;
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || typeof EventSource === "undefined") return undefined;

    const source = new EventSource(
      `${API_BASE_URL}/order-events?token=${encodeURIComponent(token)}`,
      { withCredentials: true }
    );

    const handleOrderConfirmed = (event) => {
      let payload = {};
      try {
        payload = JSON.parse(event.data || "{}");
      } catch {
        payload = {};
      }

      const eventKitchenTypes = Array.isArray(payload.kitchenTypes)
        ? payload.kitchenTypes.map((value) => String(value).toLowerCase())
        : [];
      const isForThisOutlet =
        eventKitchenTypes.length === 0 ||
        eventKitchenTypes.includes(String(kitchenType).toLowerCase());

      if (!isForThisOutlet) return;

      skipNextDetectedSoundRef.current = true;
      playNewOrderSound();
      fetchOrders({ silent: true, playOnNew: false });
    };

    source.addEventListener("order-confirmed", handleOrderConfirmed);

    return () => {
      source.removeEventListener("order-confirmed", handleOrderConfirmed);
      source.close();
    };
  }, [fetchOrders, kitchenType, playNewOrderSound]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchOrders({ silent: true });
    }, 3000);
    return () => window.clearInterval(intervalId);
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
  const safeTotalPages = Math.max(1, totalPages || 0);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredOrders.slice(start, start + rowsPerPage);
  }, [filteredOrders, currentPage]);

  useEffect(() => setCurrentPage(1), [searchTerm]);

  // Clamp current page when filtered results change (prevents going to Page 2 of 1, etc.)
  useEffect(() => {
    setCurrentPage((prev) => {
      const next = Math.min(Math.max(prev, 1), safeTotalPages);
      return next === prev ? prev : next;
    });
  }, [safeTotalPages]);

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

      const params = new URLSearchParams();
      if (updated.ORDERNUMBER) params.set("orderNumber", String(updated.ORDERNUMBER));
      params.set("kitchenType", String(kitchenType || "Bar"));

      navigate(`../order-details?${params.toString()}`, {
        state: { ...updated, kitchenType },
      });
    } catch (err) {
      alert("Failed to open order");
    }
  };

  const handleCancelOrder = async (order, event) => {
    event.stopPropagation();

    if (order.CAN_CANCEL !== "Y" || cancellingOrder) return;

    const orderNumber = order.ORDERNUMBER;
    if (!window.confirm(`Are you sure you want to cancel Order #${orderNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      setCancellingOrder(String(orderNumber));
      await barOrdersAPI.cancelOrder({
        ORDERNUMBER: orderNumber,
        KITCHEN: kitchenType,
      });
      alert("Order cancelled successfully!");
      fetchOrders();
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert("Failed to cancel order. Please try again.");
    } finally {
      setCancellingOrder("");
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
          className="outlet-orders-topbar"
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

          <div className="outlet-orders-search" style={{ position: "relative", width: "100%", maxWidth: 340, minWidth: 0 }}>
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
            <div className="outlet-orders-table-wrapper">
              <table className="outlet-orders-table" style={{ width: "100%", fontSize: 14 }}>
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
                      <td data-label="Order No" style={td}>
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

                      <td data-label="Name" style={td}>{toInitCap(o.FIRST_NAME || "")}</td>

                      <td data-label="Status" style={td}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            ...getStatusStyle(o.STATUS),
                          }}
                        >
                          {toInitCap(o.STATUS || "")}
                        </span>
                      </td>

                      <td data-label="Date" style={td}>{formatDisplayDate(o.CREATION_DATE)}</td>
                      <td data-label="Bar" style={td}>{toInitCap(o.Handled_by_bar || "")}</td>
                      <td data-label="Kitchen" style={td}>{toInitCap(o.Handled_by_kitchen || "")}</td>

                      <td data-label="Cancel" style={{ ...td, textAlign: "center" }}>
                        {cancellingOrder === String(o.ORDERNUMBER) ? (
                          <FaSpinner className="spin" style={{ color: "#999" }} />
                        ) : (
                          <FaTimesCircle
                            onClick={(event) => handleCancelOrder(o, event)}
                            title={o.CAN_CANCEL === "Y" ? "Cancel order" : "Order cannot be cancelled"}
                            style={{
                              color:
                                o.CAN_CANCEL === "Y" ? "#e74c3c" : "#ccc",
                              cursor:
                                o.CAN_CANCEL === "Y"
                                  ? "pointer"
                                  : "not-allowed",
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                Page {currentPage} of {safeTotalPages}
              </span>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  style={{
                    opacity: currentPage <= 1 ? 0.5 : 1,
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  <FaChevronLeft />
                </button>

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(p + 1, safeTotalPages))
                  }
                  disabled={currentPage >= safeTotalPages}
                  style={{
                    opacity: currentPage >= safeTotalPages ? 0.5 : 1,
                    cursor:
                      currentPage >= safeTotalPages ? "not-allowed" : "pointer",
                  }}
                >
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
