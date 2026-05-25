import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(async () => ({
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        mini: resolve(__dirname, "mini.html"),
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
