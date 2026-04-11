/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#e0ebff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1f2a67",
        },
      },
      boxShadow: {
        soft: "0 20px 45px rgba(37, 99, 235, 0.14)",
      },
    },
  },
  plugins: [],
};
