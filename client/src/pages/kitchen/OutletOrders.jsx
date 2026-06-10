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
import { formatDisplayDate } from "../../utils/dateUtils";

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
  const [statusFilter, setStatusFilter] = useState("All");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
        context.resume().catch(() => { });
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
          context.resume().catch(() => { });
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

      const matchesSearch =
        String(o.ORDERNUMBER || "").toLowerCase().includes(search) ||
        String(o.FIRST_NAME || "").toLowerCase().includes(search) ||
        String(o.STATUS || "").toLowerCase().includes(search);

      // Status filter - if "All" show everything, otherwise filter by selected status
      const matchesStatus = statusFilter === "All" || o.STATUS === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

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

  const confirmCancelOrder = async () => {
    if (!selectedOrder) return;

    try {
      setCancellingOrder(String(selectedOrder.ORDERNUMBER));

      await barOrdersAPI.cancelOrder({
        ORDERNUMBER: selectedOrder.ORDERNUMBER,
        KITCHEN: kitchenType,
      });

      setShowConfirmModal(false);
      setShowSuccessModal(true);

      fetchOrders();
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert("Failed to cancel order. Please try again.");
    } finally {
      setCancellingOrder("");
    }
  };

  const handleCancelOrder = async (order, event) => {
    event.stopPropagation();

    if (order.CAN_CANCEL !== "Y" || cancellingOrder) return;

    // Just set the selected order and show the confirmation modal
    setSelectedOrder(order);
    setShowConfirmModal(true);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "Received":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "Preparing":
        return "bg-pink-50 text-pink-700 border border-pink-200";
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      default:
        return "bg-gray-50 text-gray-600 border border-gray-200";
    }
  };

  // Get status counts for display
  const getStatusCount = (status) => {
    if (status === "All") return orders.length;
    return orders.filter(o => o.STATUS === status).length;
  };

  return (
    <div className="p-6">
      {/* HEADER */}
      <div
        className="rounded-2xl p-5 mb-5 text-white"
        style={{ background: `linear-gradient(135deg, ${MAROON}, ${MAROON2})` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.1)", color: GOLD }}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-2xl font-bold m-0">{title}</h2>
            <p className="text-xs opacity-80 m-0">{description}</p>
          </div>
        </div>
      </div>

      {/* CARD */}
      <div className="bg-white rounded-2xl shadow-lg border overflow-hidden" style={{ borderColor: 'rgba(107,26,79,0.1)' }}>
        {/* TOP BAR */}
        <div className="p-4 border-b border-gray-100 flex justify-between gap-2.5 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold m-0">Orders List</h3>
            <p className="text-xs text-gray-500 m-0">Active and completed orders</p>
          </div>

          <div className="flex gap-2.5 items-center flex-wrap">
            <div className="relative w-64">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 transition-all"
                style={{ borderColor: 'rgba(107,26,79,0.2)', '--tw-ring-color': MAROON }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: "rgba(107,26,79,0.2)",
                "--tw-ring-color": MAROON,
              }}
            >
              <option value="All">All Orders</option>
              <option value="Received">Received</option>
              <option value="Preparing">Preparing</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="py-10 text-center">
            <FaSpinner className="animate-spin text-3xl inline-block" style={{ color: MAROON }} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-10 text-center text-gray-500">No orders found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Order No</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Bar</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Kitchen</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cancel</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedOrders.map((o, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span
                          onClick={() => handleOrderClick(o)}
                          className="font-semibold cursor-pointer hover:underline transition-all"
                          style={{ color: MAROON }}
                        >
                          {o.ORDERNUMBER}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-700">{toInitCap(o.FIRST_NAME || "")}</td>

                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusStyle(o.STATUS)}`}>
                          {toInitCap(o.STATUS || "")}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-600">{formatDisplayDate(o.CREATION_DATE)}</td>
                      <td className="px-4 py-3 text-gray-600">{toInitCap(o.Handled_by_bar || "")}</td>
                      <td className="px-4 py-3 text-gray-600">{toInitCap(o.Handled_by_kitchen || "")}</td>

                      <td className="px-4 py-3 text-center">
                        {cancellingOrder === String(o.ORDERNUMBER) ? (
                          <FaSpinner className="animate-spin text-gray-400" />
                        ) : (
                          <FaTimesCircle
                            onClick={(event) => handleCancelOrder(o, event)}
                            title={o.CAN_CANCEL === "Y" ? "Cancel order" : "Order cannot be cancelled"}
                            className={`text-xl ${o.CAN_CANCEL === "Y"
                                ? "text-red-500 hover:text-red-600 cursor-pointer transition-colors"
                                : "text-gray-300 cursor-not-allowed"
                              }`}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="px-4 py-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Page {currentPage} of {safeTotalPages}
              </span>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  style={{ borderColor: 'rgba(107,26,79,0.2)' }}
                >
                  <FaChevronLeft className="text-sm" />
                </button>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, safeTotalPages))}
                  disabled={currentPage >= safeTotalPages}
                  className="p-2 rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  style={{ borderColor: 'rgba(107,26,79,0.2)' }}
                >
                  <FaChevronRight className="text-sm" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800">
              Cancel Order
            </h3>

            <p className="mt-3 text-sm text-gray-600">
              Are you sure you want to cancel Order #
              {selectedOrder?.ORDERNUMBER}?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border px-4 py-2"
              >
                No
              </button>

              <button
                onClick={confirmCancelOrder}
                className="rounded-lg bg-red-600 px-4 py-2 text-white"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <div className="text-green-600 text-5xl">✓</div>

            <h3 className="mt-3 text-lg font-semibold">
              Order Cancelled
            </h3>

            <p className="mt-2 text-sm text-gray-600">
              The order has been cancelled successfully.
            </p>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="mt-5 rounded-lg bg-afmc-maroon px-5 py-2 text-white"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}