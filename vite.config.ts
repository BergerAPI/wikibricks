import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ isSsrBuild }) => isSsrBuild
  ? {
    publicDir: false,
    // The CMS packages are TypeScript source, so they are bundled instead of imported at runtime
    ssr: { noExternal: [/^@wikibricks\//] },
    build: {
      outDir: "dist",
      target: "node26",
      rolldownOptions: { input: "src/index.ts" },
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
      rolldownOptions: {
        input: ["global.css", "src/client/site.ts"],
      },
    },
  });
