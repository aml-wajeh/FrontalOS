import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Manifest V3 needs predictable, unhashed output paths (manifest.json
// references exact file paths), so this disables Vite's default content
// hashing and lays out dist/ as:
//   dist/popup/index.html   (+ its JS/CSS)
//   dist/background.js
//   dist/icons/*.png        (copied verbatim from public/icons)
//   dist/manifest.json      (copied verbatim from public/manifest.json)
export default defineConfig({
  root: resolve(__dirname, "src"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/index.html"),
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name].js"),
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
    // Popup + background together are tiny — a single chunk per entry
    // keeps the "load unpacked" folder easy to read, no need for
    // aggressive code-splitting on a project this size.
    target: "es2020",
  },
});
