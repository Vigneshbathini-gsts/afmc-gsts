import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  useEffect(() => {
    const message = token
      ? "You are not authorized to access this page. Please login with the correct account."
      : "Session is over. Please login again.";

    // Keep it simple and explicit per request
    // eslint-disable-next-line no-alert
    alert(message);
    navigate("/login", { replace: true, state: { from: location.state?.from || location } });
    // Intentionally runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback UI in case alerts are blocked or navigation is delayed
  return (
    <div style={{ padding: 24 }}>
      <h2>Access issue</h2>
      <p>
        {token
          ? "You are not authorized to access this page."
          : "Your session has ended."}{" "}
        Please login.
      </p>
      <button type="button" onClick={() => navigate("/login", { replace: true })}>
        Go to Login
      </button>
    </div>
  );
}
