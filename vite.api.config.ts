import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const apiPackage = JSON.parse(readFileSync(new URL("./commerce-api/package.json", import.meta.url), "utf8"));

export default defineConfig({
  ssr: {
    external: Object.keys(apiPackage.dependencies).filter((name) => name !== "firebase-admin"),
    noExternal: true,
    resolve: { conditions: ["node", "require"] },
  },
  build: {
    ssr: "server/commerce-entry.ts",
    outDir: "commerce-api/dist/bundle",
    copyPublicDir: false,
    // Keep native modules, Prisma engines and package-relative assets in their
    // installed packages. Only convert Firebase's CJS/ESM boundary for Vercel.
  },
});
