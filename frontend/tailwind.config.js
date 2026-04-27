/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff9ff",
          100: "#dff3ff",
          200: "#b7e7ff",
          300: "#7fd6ff",
          400: "#3fc0ff",
          500: "#109ae3",
          600: "#0a79b7",
          700: "#0a618f",
          800: "#0c5278",
          900: "#103f5b",
        },
        mint: {
          50: "#eefdf8",
          100: "#d1faef",
          200: "#a6f3df",
          300: "#6ae7ca",
          400: "#30d0ad",
          500: "#11b895",
          600: "#0a9478",
          700: "#0b7662",
          800: "#0d5d4f",
          900: "#0d4d43",
        },
        ink: "#0f172a",
        surface: "#f6fbfd",
        line: "#d9e9ef",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "sans-serif"],
        body: ['"Manrope"', "sans-serif"],
      },
      boxShadow: {
        soft: "0 28px 70px -34px rgba(15, 23, 42, 0.28)",
        float: "0 20px 60px -26px rgba(16, 154, 227, 0.24)",
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(circle at top left, rgba(16,154,227,0.24), transparent 40%), radial-gradient(circle at 85% 20%, rgba(17,184,149,0.18), transparent 32%), linear-gradient(180deg, #f8fdff 0%, #f3fbfd 100%)",
      },
    },
  },
  plugins: [],
};
