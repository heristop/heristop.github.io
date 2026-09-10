import { fileURLToPath } from "node:url";

export const sharedTest = {
  environment: "jsdom" as const,
  globals: false,
  setupFiles: [fileURLToPath(new URL("./tests/setup.ts", import.meta.url))],
};
