import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function matchesAllowedRole(user, allowedRoles) {
  if (!allowedRoles?.length) return true;

  return allowedRoles.some((role) => {
    if (typeof role === "number") {
      return Number(user?.roleId) === role;
    }

    return user?.roleCode === role || user?.roleName === role;
  });
}

export default function ProtectedRoute({
  allowedRoles,
  allowedOutletTypes,
  children,
}) {
  const { user } = useAuth();
  const location = useLocation();
  const token = localStorage.getItem("token");

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!matchesAllowedRole(user, allowedRoles)) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  if (
    allowedOutletTypes?.length &&
    !allowedOutletTypes.includes((user.outletType || "").toUpperCase())
  ) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return children || <Outlet />;
}
