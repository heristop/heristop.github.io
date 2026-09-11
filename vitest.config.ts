import { defineConfig } from "vitest/config";
import { sharedTest } from "./vitest.shared";

export default defineConfig({
  test: {
    maxWorkers: 3,
    projects: [
      {
        test: {
          ...sharedTest,
          name: "site",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/visual/**"],
        },
      },
      "packages/*/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/components/client/**/*.{ts,tsx}",
        "src/plugins/**/*.ts",
        "packages/*/src/**/*.{ts,tsx}",
      ],
    },
  },
});
