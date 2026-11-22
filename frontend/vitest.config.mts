import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    // Bound concurrent DOM workers: the unrestricted pool causes 5s timeouts
    // and unfinished user-event interactions to spill into subsequent tests.
    maxWorkers: 2,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
