import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL, barStatusAPI, messTimingsAPI } from "../services/api";
import { getToken } from "../utils/authStorage";

const EXEMPT_ROLES = [10, 40];
const FALLBACK_POLL_INTERVAL_MS = 60000;

function isPublicPath(pathname) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password") ||
    pathname === "/bar-closed"
  );
}

export default function BarStatusGuard({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();

    if (isLoading || !token || !user || isPublicPath(location.pathname)) {
      return undefined;
    }

    const roleId = Number(user.roleId);
    if (EXEMPT_ROLES.includes(roleId)) {
      return undefined;
    }

    let cancelled = false;
    let source;
    let fallbackIntervalId;

    const handleStatus = (barStatus) => {
      if (!cancelled && barStatus?.bar_status === "Bar Is Close") {
        navigate("/bar-closed", { replace: true });
      }
    };

    const handleMessStatus = (messStatus) => {
      if (!cancelled && messStatus?.isOpen === false) {
        navigate("/bar-closed", { replace: true });
      }
    };

    const checkBarStatusOnce = async () => {
      try {
        const [barResponse, messResponse] = await Promise.all([
          barStatusAPI.getStatus(),
          messTimingsAPI.getCurrentStatus(),
        ]);
        handleStatus(barResponse.data?.data);
        handleMessStatus(messResponse.data);
      } catch (error) {
        const closureCode = error.response?.data?.code;
        if (closureCode === "BAR_CLOSED" || closureCode === "MESS_CLOSED") {
          navigate("/bar-closed", { replace: true });
          return;
        }

        console.error("Unable to check bar status:", error);
      }
    };

    checkBarStatusOnce();

    if (typeof EventSource !== "undefined") {
      source = new EventSource(
        `${API_BASE_URL}/bar-status/events?token=${encodeURIComponent(token)}`,
        { withCredentials: true }
      );

      source.addEventListener("bar-status", (event) => {
        try {
          handleStatus(JSON.parse(event.data || "{}"));
        } catch {
          // Ignore invalid event payloads.
        }
      });
    } else {
      fallbackIntervalId = window.setInterval(
        checkBarStatusOnce,
        FALLBACK_POLL_INTERVAL_MS
      );
    }

    return () => {
      cancelled = true;
      if (source) source.close();
      if (fallbackIntervalId) window.clearInterval(fallbackIntervalId);
    };
  }, [isLoading, location.pathname, navigate, user]);

  return children;
}
