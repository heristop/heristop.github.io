import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { sharedTest } from "../../vitest.shared";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    ...sharedTest,
    name: "ui",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/visual/**"],
  },
});
