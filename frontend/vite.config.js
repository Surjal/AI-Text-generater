import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/process-text": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      "/user": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
