import axios from "axios";
import axiosRetry from "axios-retry";
import { clearAuthData, getToken } from "../utils/authStorage";

const clearOrderHistoryFilters = () => {
  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (
        key === "orderHistoryFilters" ||
        key.startsWith("orderHistoryFilters:")
      ) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (_) {
    // Ignore storage access errors.
  }
};

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const getDefaultApiBase = () => {
  if (typeof window === "undefined") {
    return "http://localhost:7300/AFMCMESS/api";
  }

  const { protocol, hostname, port, origin } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const backendOrigin = `${protocol}//${hostname}:7300`;
    return `${backendOrigin}/AFMCMESS/api`;
  }

  if (port === "3000") {
    return `${protocol}//${hostname}:7300/AFMCMESS/api`;
  }

  return `${origin}/AFMCMESS/api`;
};

export const API_BASE_URL = trimTrailingSlash(
  process.env.REACT_APP_API_URL || getDefaultApiBase()
);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const dispatchNetworkEvent = (type) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(type));
  }
};

const isBackendNetworkError = (err) => {
  const code = err?.response?.data?.code;
  return code === "NETWORK_ERROR" || code === "GATEWAY_TIMEOUT";
};

axiosRetry(apiClient, {
  retries: 3,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status >= 500,
  retryDelay: (retryCount) => retryCount * 2000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!navigator.onLine) {
      dispatchNetworkEvent("app-network-offline");
      return Promise.reject(new Error("NETWORK_DISCONNECTED"));
    }

    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      dispatchNetworkEvent("app-network-slow");
      return Promise.reject(new Error("NETWORK_TIMEOUT"));
    }

    if (isBackendNetworkError(err)) {
      const code = err.response?.data?.code;
      if (code === "GATEWAY_TIMEOUT") {
        dispatchNetworkEvent("app-network-slow");
      } else if (code === "NETWORK_ERROR") {
        dispatchNetworkEvent("app-network-offline");
      }
      return Promise.reject(new Error(code));
    }

    if (
      err.response?.status === 403 &&
      err.response?.data?.code === "BAR_CLOSED" &&
      !window.location.pathname.includes("/bar-closed")
    ) {
      window.location.href = "/bar-closed";
    }

    if (
      err.response?.status === 401 &&
      !window.location.pathname.includes("/login")
    ) {
      clearAuthData();
      clearOrderHistoryFilters();
      window.location.href = "/login";
    }

    return Promise.reject(err);
  }
);

export async function authFetchJson(input, init = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });

  if (res.status === 401 && !window.location.pathname.includes("/login")) {
    clearAuthData();
    clearOrderHistoryFilters();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (
      res.status === 403 &&
      data?.code === "BAR_CLOSED" &&
      !window.location.pathname.includes("/bar-closed")
    ) {
      window.location.href = "/bar-closed";
    }

    const message =
      (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  if (data?.success === false) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}

export default apiClient;
