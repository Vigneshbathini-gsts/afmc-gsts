// src/styles/theme.js

// Color palette (matching login page)
export const colors = {
  // Primary colors
  maroon: "#6B1A4F",
  maroon2: "#7B2252",
  maroonDark: "#3A0D30",
  maroonLight: "#5c1648",
  
  // Gold accent
  gold: "#DAA520",
  goldDim: "rgba(218,165,32,0.65)",
  goldLight: "rgba(218,165,32,0.1)",
  
  // Neutrals
  white: "#ffffff",
  black: "#1a1a1a",
  gray: "#888",
  grayLight: "#aaa",
  grayLighter: "#bbb",
  
  // Backgrounds
  bgLeft: "linear-gradient(145deg, #3A0D30 0%, #5c1648 45%, #6B1A4F 100%)",
  bgRight: "linear-gradient(135deg, #faf8f9 0%, #f5f0f3 100%)",
  
  // Status
  error: "#e74c3c",
  errorBg: "#fff5f5",
  errorBorder: "#f5c2c7",
  success: "#27ae60",
};

// Spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Border radius
export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 20,
  round: "50%",
};

// Shadows
export const shadows = {
  sm: "0 2px 8px rgba(107,26,79,0.1)",
  md: "0 4px 14px rgba(107,26,79,0.15)",
  lg: "0 8px 25px rgba(107,26,79,0.2)",
  xl: "0 8px 40px rgba(107,26,79,0.1)",
  button: "0 4px 14px rgba(107,26,79,0.3)",
};

// Animations (keyframes as CSS strings)
export const animations = {
  fadeUp: `
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `,
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `,
  spin: `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.08); opacity: 0.75; }
    }
  `,
};