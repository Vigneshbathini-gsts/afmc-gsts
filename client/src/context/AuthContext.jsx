import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const AUTH_USER_STORAGE_KEY = "authUser";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!storedUser) {
      setUser(null);
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch (error) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      setUser(null);
    }
  }, []);

  const setAuthenticatedUser = (userData) => {
    if (!userData) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      setUser(null);
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
  };

  const clearUser = () => {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, setUser: setAuthenticatedUser, clearUser }),
    [user]
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
