import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { barStatusAPI } from "../services/api";
import { getToken } from "../utils/authStorage";

const EXEMPT_ROLES = [10, 40];
const POLL_INTERVAL_MS = 2000;

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
    if (isLoading || !getToken() || !user || isPublicPath(location.pathname)) {
      return undefined;
    }

    const roleId = Number(user.roleId);
    if (EXEMPT_ROLES.includes(roleId)) {
      return undefined;
    }

    let cancelled = false;

    const checkBarStatus = async () => {
      try {
        const response = await barStatusAPI.getStatus();
        const currentStatus = response.data?.data?.bar_status;

        if (!cancelled && currentStatus === "Bar Is Close") {
          navigate("/bar-closed", { replace: true });
        }
      } catch (error) {
        if (error.response?.data?.code !== "BAR_CLOSED") {
          console.error("Unable to check bar status:", error);
        }
      }
    };

    checkBarStatus();
    const intervalId = window.setInterval(checkBarStatus, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isLoading, location.pathname, navigate, user]);

  return children;
}
