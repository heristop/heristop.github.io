import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
// Reuse the game's TypeScript in Node without bundling or loading the browser app.
// Node strips types; this hook resolves the extensionless imports used by Astro.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      for (const suffix of [".ts", "/index.ts"]) {
        const candidate = new URL(specifier + suffix, context.parentURL);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
