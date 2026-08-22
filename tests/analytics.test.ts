// The mode decides two things that must agree: which tag BaseHead renders, and whether the site
// carries a consent bar at all. A disagreement is silent — either an unasked cookie, or a bar over
// a site that sets none — so both come from these functions, and this pins them.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT_SRC = "https://stats.example.test/script.js";
const WEBSITE_ID = "0d1e2f34-5678-49ab-cdef-0123456789ab";

const loadAnalytics = async () => import("../src/analytics");

describe("analytics mode", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("UMAMI_SRC", "");
    vi.stubEnv("UMAMI_WEBSITE_ID", "");
    vi.stubEnv("UMAMI_HOST_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs Google Analytics by default, and asks before measuring", async () => {
    const { analyticsMode, consentRequired } = await loadAnalytics();

    expect(analyticsMode()).toBe("ga");
    expect(consentRequired()).toBe(true);
  });

  it("runs Umami when both halves are set, and asks nothing", async () => {
    vi.stubEnv("UMAMI_SRC", SCRIPT_SRC);
    vi.stubEnv("UMAMI_WEBSITE_ID", WEBSITE_ID);

    const { analyticsMode, consentRequired, umamiConfig } = await loadAnalytics();

    // Umami sets no cookie and stores no visitor identifier: nothing to consent to.
    expect(analyticsMode()).toBe("umami");
    expect(consentRequired()).toBe(false);
    expect(umamiConfig()).toEqual({ scriptSrc: SCRIPT_SRC, websiteId: WEBSITE_ID, hostUrl: undefined });
  });

  it("lets Umami win over the GA property, rather than measuring twice", async () => {
    vi.stubEnv("UMAMI_SRC", SCRIPT_SRC);
    vi.stubEnv("UMAMI_WEBSITE_ID", WEBSITE_ID);

    const { analyticsMode, GA_MEASUREMENT_ID } = await loadAnalytics();

    expect(GA_MEASUREMENT_ID).not.toBe("");
    expect(analyticsMode()).toBe("umami");
  });

  it("ignores a half-configured Umami rather than rendering a tag that cannot send", async () => {
    vi.stubEnv("UMAMI_SRC", SCRIPT_SRC);

    const { analyticsMode, umamiConfig } = await loadAnalytics();

    expect(umamiConfig()).toBeUndefined();
    // Still asking, still on GA — a stray variable must not take the bar away.
    expect(analyticsMode()).toBe("ga");
  });

  it("treats blank-only values as unset", async () => {
    vi.stubEnv("UMAMI_SRC", "   ");
    vi.stubEnv("UMAMI_WEBSITE_ID", "   ");

    const { analyticsMode } = await loadAnalytics();

    expect(analyticsMode()).toBe("ga");
  });

  it("carries a separate collect host through only when it differs", async () => {
    vi.stubEnv("UMAMI_SRC", SCRIPT_SRC);
    vi.stubEnv("UMAMI_WEBSITE_ID", WEBSITE_ID);
    vi.stubEnv("UMAMI_HOST_URL", "https://collect.example.test");

    const { umamiConfig } = await loadAnalytics();

    expect(umamiConfig()?.hostUrl).toBe("https://collect.example.test");
  });
});

// The components carry these values as literals: an .astro inline script is emitted verbatim, so
// nothing interpolates a constant into it and nothing typechecks what is inside. Changing the
// property id or the storage key here would otherwise keep sending to the old property, or read a
// key nothing writes, with every test still green.
describe("the literals the components carry", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (file: string): string => readFileSync(path.join(root, file), "utf8");

  it("configures and loads the property named in analytics.ts", async () => {
    const { GA_MEASUREMENT_ID } = await loadAnalytics();
    const head = read("src/components/BaseHead.astro");

    expect(head).toContain(`gtag("config", "${GA_MEASUREMENT_ID}"`);
    expect(head).toContain(`gtag/js?id=${GA_MEASUREMENT_ID}`);
  });

  it("reads and clears the same storage key the bar writes", async () => {
    const { CONSENT_STORAGE_KEY } = await loadAnalytics();

    // Written by the bar, read by the GA snippet, removed by the Umami switch-over — three places,
    // one key.
    expect(read("src/components/CookieConsent.astro")).toContain(`"${CONSENT_STORAGE_KEY}"`);
    expect(read("src/components/BaseHead.astro")).toContain(`getItem("${CONSENT_STORAGE_KEY}")`);
    expect(read("src/components/BaseHead.astro")).toContain(`removeItem("${CONSENT_STORAGE_KEY}")`);
  });

  it("renders no tag at all when nothing is configured", () => {
    // `none` must not fall through to the GA snippet: its id is a literal in the file, so the
    // gate is the only thing keeping it off the page.
    expect(read("src/components/BaseHead.astro")).toContain("{tracker === 'ga' && (");
  });
});
