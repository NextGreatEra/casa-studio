import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.join(rootDir, "client"),
  resolve: {
    alias: {
      "@shared": path.join(rootDir, "shared"),
    },
  },
  build: {
    outDir: path.join(rootDir, "dist/client"),
    emptyOutDir: true,
  },
  server: {
    middlewareMode: true,
  },
});
