import React, { useEffect, useRef } from "react";
import AppRoutes from "./routes/AppRoutes";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppContent() {
  const { isOnline, isSlow } = useAuth();
  const offlineToastId = useRef(null);

  useEffect(() => {
    // 1. Handle complete disconnections
    if (!isOnline) {
      // Use an explicit toastId so we don't open duplicate "Offline" toasts
      if (!toast.isActive(offlineToastId.current)) {
        offlineToastId.current = toast.error("No Internet Connection. Working offline.", {
          position: "top-center",
          autoClose: false, // Keep it visible until the user goes back online
          closeOnClick: false,
          draggable: false,
        });
      }
    } else {
      // When the user comes back online, clear the offline toast and show success
      if (offlineToastId.current) {
        toast.dismiss(offlineToastId.current);
        offlineToastId.current = null;
        toast.success(" Connected back to the internet please refresh the page!", {
          position: "top-center",
          autoClose: 2000,
        });
      }
    }
  }, [isOnline]);

  useEffect(() => {
    // 2. Handle slow network warnings
    if (isOnline && isSlow) {
      toast.warning("Slow connection detected. Retrying request...", {
        position: "top-right",
        autoClose: 3000, // Let it auto-dismiss after 3 seconds
      });
    }
  }, [isSlow, isOnline]);

  return <AppRoutes />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
        <ToastContainer
          position="top-right"
          autoClose={1800}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
