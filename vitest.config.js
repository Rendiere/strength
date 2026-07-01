import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    // node:sqlite is a builtin; keep vite from trying to transform/bundle it.
    server: { deps: { external: ["node:sqlite"] } },
  },
  ssr: { external: ["node:sqlite"] },
});
