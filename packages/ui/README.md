# Shared UI

`@zazencode/ui` owns the icon registry, accessible React icon component and text-reveal animation used by the site and game. It has no application or game dependency. React and React DOM are shared peer dependencies.

Import only the required subpath: `icon`, `icon-registry`, `text-reveal`, `text-reveal-motion`, `text-reveal-hooks` or `pretext-loader`. Separate exports keep consumers from loading unrelated UI. Icons and text animation import their own styles, so they do not depend on application stylesheet definitions.

Run `pnpm --filter @zazencode/ui test` and `pnpm --filter @zazencode/ui check` from the workspace root. Shared Vitest setup lives at the root; production source never imports it.

## Future private distribution

`private: true` blocks publication. If registry distribution is enabled later, `publishConfig.access` defaults to `restricted` and `files` limits the package to its runtime source and required assets. Source artwork, training reports and tests remain outside the registry artifact. Keep registry credentials in the consuming environment, never in this repository.

The application imports package exports and declares `workspace:*` dependencies. A future move to a private registry can replace those dependency specifiers with published versions without changing application imports. The shared UI dependency must be available to the same consumers.
