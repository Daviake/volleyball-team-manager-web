import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  test: {
    // As regras de negócio e o storage são testados no Node, sem navegador.
    environment: "node",
    include: ["src/tests/**/*.test.js"]
  }
});
