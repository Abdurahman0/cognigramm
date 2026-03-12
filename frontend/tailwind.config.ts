import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          50: "#f7f8fa",
          100: "#edf0f5",
          200: "#dce2ec",
          300: "#c0cbdd",
          400: "#96a8c7",
          500: "#6f87b2",
          600: "#566d96",
          700: "#455776",
          800: "#3b495f",
          900: "#353f51"
        },
        accent: {
          50: "#edfcff",
          100: "#d7f7ff",
          200: "#b5f1ff",
          300: "#80e8ff",
          400: "#44dbff",
          500: "#17c3ff",
          600: "#009ae4",
          700: "#0079b8",
          800: "#066696",
          900: "#0c557b"
        }
      },
      boxShadow: {
        "soft-lg": "0 10px 30px rgba(15, 23, 42, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
