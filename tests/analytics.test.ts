// The mode decides two things that must agree: which tag BaseHead renders, and whether the site
// carries a consent bar at all. A disagreement is silent — either an unasked cookie, or a bar over
// a site that sets none — so both come from these functions, and this pins them.

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
