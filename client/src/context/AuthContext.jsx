import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cartAPI } from "../services/api";
import { storeAuthData, clearAuthData, getStoredUser } from "../utils/authStorage";
import { getCartCount } from "../utils/cartCount";

const AuthContext = createContext(null);
const AUTH_USER_STORAGE_KEY = "authUser";
const ORDER_HISTORY_FILTER_PREFIX = "orderHistoryFilters";

const clearOrderHistoryFilters = () => {
  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (key === ORDER_HISTORY_FILTER_PREFIX || key.startsWith(`${ORDER_HISTORY_FILTER_PREFIX}:`)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (_) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  
  //  NEW: Global Network States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlow, setIsSlow] = useState(false);

  //  NEW: Handle Network Event Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setIsSlow(false); // Reset slow flag if fully offline
    };

    const handleSlowNetworkEvent = () => {
      setIsSlow(true);
      setTimeout(() => setIsSlow(false), 5000); // Auto-hide slow banner after 5s
    };

    // Native browser connection hooks
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Custom hooks bound to your Axios file events
    window.addEventListener('app-network-offline', handleOffline);
    window.addEventListener('app-network-slow', handleSlowNetworkEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('app-network-offline', handleOffline);
      window.removeEventListener('app-network-slow', handleSlowNetworkEvent);
    };
  }, []);

  const fetchCartCount = async (userId) => {
    if (!userId) {
      setCartCount(0);
      return;
    }

    try {
      const response = await cartAPI.getByUserId(userId);
      const items = response.data?.data || [];
      setCartCount(getCartCount(items));
    } catch (error) {
      console.error("Failed to load cart count:", error);
      setCartCount(0);
    }
  };

  useEffect(() => {
    const storedUser = getStoredUser();

    if (!storedUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setUser(storedUser);
    } catch (error) {
      clearAuthData();
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCartCount(user?.userId);
  }, [user?.userId]);

  const setAuthenticatedUser = (userData) => {
    if (!userData) {
      clearAuthData();
      setUser(null);
      setCartCount(0);
      setIsLoading(false);
      return;
    }

    const normalizedUser = {
      userId: userData.userId,
      username: userData.username,
      email: userData.email,
      phoneNumber: userData.phoneNumber,
      loginType: userData.loginType || null,
      roleId: userData.roleId,
      roleCode: userData.roleCode,
      roleName: userData.roleName,
      outletType: userData.outletType || null,
    };

    storeAuthData(null, normalizedUser);
    setUser(normalizedUser);
    setIsLoading(false);
  };

  const clearUser = () => {
    clearOrderHistoryFilters();
    clearAuthData();
    setUser(null);
    setIsLoading(false);
  };

  //  NEW: Added isOnline and isSlow variables to the Memoized values
  const value = useMemo(
    () => ({ 
      user, 
      isLoading, 
      setUser: setAuthenticatedUser, 
      clearUser, 
      cartCount, 
      setCartCount,
      isOnline, 
      isSlow 
    }),
    [user, isLoading, cartCount, isOnline, isSlow]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export default AuthContext;
