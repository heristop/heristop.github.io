// One tracker, and the page either carries it or carries nothing. What is worth
// pinning is that the token is the only thing deciding, and that the beacon and
// the leftover-cookie cleanup are actually in the component — an Astro inline
// script is emitted verbatim, so nothing typechecks what is inside it.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string): string => readFileSync(path.join(root, file), "utf8");

const loadAnalytics = async () => import("../src/analytics");

describe("cloudflareToken", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("CLOUDFLARE_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the token when one is configured", async () => {
    vi.stubEnv("CLOUDFLARE_TOKEN", "abc123");

    const { cloudflareToken } = await loadAnalytics();

    expect(cloudflareToken()).toBe("abc123");
  });

  it("is undefined once the configuration is taken away", async () => {
    const { cloudflareToken } = await loadAnalytics();

    // Which is what switches measurement off: nothing is hardcoded to keep it
    // alive, the way a measurement id in the source used to.
    expect(cloudflareToken()).toBeUndefined();
  });

  it("treats a blank-only token as unset", async () => {
    vi.stubEnv("CLOUDFLARE_TOKEN", "   ");

    const { cloudflareToken } = await loadAnalytics();

    expect(cloudflareToken()).toBeUndefined();
  });
});

describe("what the page carries", () => {
  const head = read("src/components/BaseHead.astro");

  it("renders the beacon only when a token is configured", () => {
    expect(head).toContain("{cloudflare && (");
    expect(head).toContain("static.cloudflareinsights.com/beacon.min.js");
  });

  it("carries no Google Analytics and no Umami any more", () => {
    expect(head).not.toContain("googletagmanager");
    expect(head).not.toContain("gtag(");
    expect(head).not.toContain("data-website-id");
  });

  it("still clears what the removed tracker left in browsers that had accepted", async () => {
    const { CONSENT_STORAGE_KEY } = await loadAnalytics();

    // The bar is gone, so nobody can withdraw an old yes by hand any more.
    expect(head).toContain(`removeItem("${CONSENT_STORAGE_KEY}")`);
    expect(head).toContain("_ga");
  });
});

describe("the rest of the site", () => {
  it("mounts no consent bar anywhere", () => {
    for (const file of ["src/layouts/Layout.astro", "src/pages/index.astro"]) {
      expect(read(file), `${file} still mounts the bar`).not.toContain("CookieConsent");
    }

    expect(read("src/components/Footer.astro")).not.toContain("consent");
  });

  it("hands the token to the deploy, or the switch could never be flipped", () => {
    // The build reads it from the env; a workflow that does not pass it would
    // make the setting unreachable in production and fail silently.
    expect(read(".github/workflows/astro-gh-pages.yml")).toContain(
      "CLOUDFLARE_TOKEN: ${{ vars.CLOUDFLARE_TOKEN }}",
    );
  });
});
