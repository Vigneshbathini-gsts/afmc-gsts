import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { cartAPI } from "../services/api";

const AuthContext = createContext(null);
const AUTH_USER_STORAGE_KEY = "authUser";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = async (userId) => {
    if (!userId) {
      setCartCount(0);
      return;
    }

    try {
      const response = await cartAPI.getByUserId(userId);
      const items = response.data?.data || [];
      const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      setCartCount(count);
    } catch (error) {
      console.error("Failed to load cart count:", error);
      setCartCount(0);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!storedUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch (error) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCartCount(user?.userId);
  }, [user?.userId]);

  const setAuthenticatedUser = (userData) => {
    if (!userData) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
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
      roleId: userData.roleId,
      roleCode: userData.roleCode,
      roleName: userData.roleName,
      outletType: userData.outletType || null,
    };

    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    setIsLoading(false);
  };

  const clearUser = () => {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
    setIsLoading(false);
  };

  const value = useMemo(
    () => ({ user, isLoading, setUser: setAuthenticatedUser, clearUser, cartCount, setCartCount }),
    [user, isLoading, cartCount]
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
