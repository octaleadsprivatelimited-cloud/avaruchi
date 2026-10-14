import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ isSsrBuild }) => ({
  server: {
    port: 5180,
    strictPort: true,
  },
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
  build: { outDir: ".output/public", emptyOutDir: true, copyPublicDir: !isSsrBuild },
}));
