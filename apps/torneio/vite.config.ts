import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
  server: {
    port: 5173,
  },
});
