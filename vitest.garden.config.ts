import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["tests/components/client/garden/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/components/client/garden/**/*.{ts,tsx}"],
      reportsDirectory: "./coverage/garden",
      reporter: ["text", "html", "json", "json-summary"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
