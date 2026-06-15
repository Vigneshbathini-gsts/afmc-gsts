import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getToken, clearAuthData } from "../utils/authStorage";

function matchesAllowedRole(user, allowedRoles) {
  if (!allowedRoles?.length) return true;

  return allowedRoles.some((role) => {
    if (typeof role === "number") {
      return Number(user?.roleId) === role;
    }

    return user?.roleCode === role || user?.roleName === role;
  });
}

function ForceLogoutNavigate({ to, state }) {
  const { clearUser } = useAuth();

  useEffect(() => {
    try {
      clearAuthData();
    } catch (e) {
      // ignore
    }
    clearUser();
  }, [clearUser]);

  return <Navigate to={to} replace state={state} />;
}

export default function ProtectedRoute({
  allowedRoles,
  allowedOutletTypes,
  roleLoginTypeRules,
  children,
}) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const token = getToken();

  if (isLoading) {
    return <div>Loading...</div>; // Or a proper loading component
  }

  if (!token || !user) {
    return (
      <ForceLogoutNavigate
        to="/login"
        state={{ from: location, reason: "sessionEnded" }}
      />
    );
  }

  if (!matchesAllowedRole(user, allowedRoles)) {
    return (
      <ForceLogoutNavigate
        to="/login"
        state={{ from: location, reason: "sessionEnded" }}
      />
    );
  }

  if (roleLoginTypeRules && typeof roleLoginTypeRules === "object") {
    const roleKey = String(user?.roleId ?? "");
    const allowedLoginTypes = roleLoginTypeRules[roleKey];
    if (Array.isArray(allowedLoginTypes) && allowedLoginTypes.length > 0) {
      const normalized = String(user?.loginType || "").trim().toUpperCase();
      const ok = allowedLoginTypes.some(
        (t) => String(t || "").trim().toUpperCase() === normalized
      );
      if (!ok) {
        return (
          <ForceLogoutNavigate
            to="/login"
            state={{ from: location, reason: "sessionEnded" }}
          />
        );
      }
    }
  }

  if (
    allowedOutletTypes?.length &&
    !allowedOutletTypes.includes((user.outletType || "").toUpperCase())
  ) {
    return (
      <ForceLogoutNavigate
        to="/login"
        state={{ from: location, reason: "sessionEnded" }}
      />
    );
  }

  return children || <Outlet />;
}
