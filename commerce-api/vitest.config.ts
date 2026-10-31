import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Shared storefront helpers live beside the API, so both source trees must
  // belong to the test project when Vite resolves dynamic module imports.
  root: fileURLToPath(new URL("../", import.meta.url)),
  test: {
    env: { STORE_ADMIN_EMAIL: "avaruchi.admin.fixture@gmail.com" },
    environment: "node",
    include: ["commerce-api/tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: { conditions: ["node"] },
});
