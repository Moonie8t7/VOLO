import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Static single-page app. There is no backend: the masterlist is a static JSON
// asset and all sorting happens in the browser, so this builds to plain files
// that any CDN can serve.
export default defineConfig({
  plugins: [react()],
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "public"),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    // The masterlist is the large asset and it's fetched, not bundled.
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
