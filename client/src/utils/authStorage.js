/**
 * Centralized authentication storage utilities
 * Handles localStorage operations for JWT tokens and user data
 */

const AUTH_KEYS = {
  TOKEN: "token",
  USER: "authUser",
  REMEMBER_ME: "afmc_remember_me",
  REMEMBERED_EMAIL: "afmc_remembered_email",
};

const USER_SPECIFIC_PREFIXES = [
  "afmc-custom-item-draft:",
  "afmc-buyflow-custom:",
];

/**
 * Store authentication data after successful login
 * @param {string} token - JWT token from server
 * @param {object} user - User object from server
 * @param {boolean} rememberMe - Whether to remember the user
 */
export const storeAuthData = (token, user, rememberMe = false) => {
  try {
    if (token) {
      localStorage.setItem(AUTH_KEYS.TOKEN, token);
    }
    if (user) {
      localStorage.setItem(AUTH_KEYS.USER, JSON.stringify(user));
    }
    localStorage.setItem(AUTH_KEYS.REMEMBER_ME, rememberMe ? "true" : "false");
  } catch (error) {
    console.error("Error storing auth data:", error);
  }
};

/**
 * Retrieve stored authentication data
 * @returns {object} { token, user, rememberMe }
 */
export const getAuthData = () => {
  try {
    const token = localStorage.getItem(AUTH_KEYS.TOKEN);
    const userStr = localStorage.getItem(AUTH_KEYS.USER);
    const rememberMe = localStorage.getItem(AUTH_KEYS.REMEMBER_ME) === "true";

    return {
      token,
      user: userStr ? JSON.parse(userStr) : null,
      rememberMe,
    };
  } catch (error) {
    console.error("Error retrieving auth data:", error);
    return { token: null, user: null, rememberMe: false };
  }
};

/**
 * Clear all authentication data from localStorage
 * This is called on logout or when token expires
 */
export const clearAuthData = () => {
  try {
    localStorage.removeItem(AUTH_KEYS.TOKEN);
    localStorage.removeItem(AUTH_KEYS.USER);
    localStorage.removeItem(AUTH_KEYS.REMEMBER_ME);

    // Remove user-specific draft data keys as well
    Object.keys(localStorage).forEach((key) => {
      if (USER_SPECIFIC_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    });

    // Don't remove remembered email - user might want to log in again with same credentials
  } catch (error) {
    console.error("Error clearing auth data:", error);
  }
};

/**
 * Store remembered email for "Remember Me" functionality
 * @param {string} email - Email to remember
 */
export const storeRememberedEmail = (email) => {
  try {
    if (email) {
      localStorage.setItem(AUTH_KEYS.REMEMBERED_EMAIL, email);
    } else {
      localStorage.removeItem(AUTH_KEYS.REMEMBERED_EMAIL);
    }
  } catch (error) {
    console.error("Error storing remembered email:", error);
  }
};

/**
 * Retrieve stored remembered email
 * @returns {string|null} Remembered email or null
 */
export const getRememberedEmail = () => {
  try {
    return localStorage.getItem(AUTH_KEYS.REMEMBERED_EMAIL);
  } catch (error) {
    console.error("Error retrieving remembered email:", error);
    return null;
  }
};

/**
 * Retrieve stored remember me preference
 * @returns {boolean} Remember me preference
 */
export const getRememberMePreference = () => {
  try {
    const rememberMe = localStorage.getItem(AUTH_KEYS.REMEMBER_ME) === "true";
    return rememberMe;
  } catch (error) {
    console.error("Error retrieving remember me preference:", error);
    return false;
  }
};

/**
 * Get the stored JWT token
 * @returns {string|null} JWT token or null
 */
export const getToken = () => {
  try {
    return localStorage.getItem(AUTH_KEYS.TOKEN);
  } catch (error) {
    console.error("Error retrieving token:", error);
    return null;
  }
};

/**
 * Get the stored user data
 * @returns {object|null} User object or null
 */
export const getStoredUser = () => {
  try {
    const userStr = localStorage.getItem(AUTH_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error("Error retrieving stored user:", error);
    return null;
  }
};
