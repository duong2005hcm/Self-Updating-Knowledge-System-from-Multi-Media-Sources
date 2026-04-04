import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://self-updating-knowledge-system-from.onrender.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
