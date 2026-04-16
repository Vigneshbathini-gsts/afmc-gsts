/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        afmc: {
          maroon: "#6B1A4F",
          maroon2: "#7B2252",
          maroonDark: "#3A0D30",
          gold: "#ffd363",
          bg: "#faf8f9",
          bg2: "#f5f0f3",
          ink: "#1a1a1a",
        },
      },
      fontFamily: {
        sans: ["'Source Sans 3'", ...defaultTheme.fontFamily.sans],
        display: ["'Cinzel'", ...defaultTheme.fontFamily.serif],
      },
      boxShadow: {
        afmc: "0 8px 40px rgba(107,26,79,0.12)",
      },
    },
  },
  plugins: [],
}
