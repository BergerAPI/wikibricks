import { readdirSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const pages = readdirSync("src/client/pages")
  .filter(file => file.endsWith(".ts"))
  .map(file => `src/client/pages/${file}`);

export default defineConfig(({ isSsrBuild }) => isSsrBuild
  ? {
    publicDir: false,
    build: {
      outDir: "dist",
      target: "node26",
      rollupOptions: { input: "src/index.ts" },
    },
  }
  : {
    plugins: [tailwindcss()],
    build: {
      outDir: "dist/client",
      // The server serves public/ itself.
      copyPublicDir: false,
      manifest: true,
      modulePreload: { polyfill: false },
      rollupOptions: { input: ["global.css", ...pages] },
    },
  });
