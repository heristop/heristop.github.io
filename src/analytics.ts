// Which tracker the site runs, decided from the env at build time.
//
// Astro renders components on the build machine, so the components below read this directly: the
// page ships with one tracker's tag and nothing of the other's — no runtime branch, no swap step.

type AnalyticsMode = "umami" | "ga" | "none";

interface UmamiConfig {
  scriptSrc: string;
  websiteId: string;
  /** Only when the collect API answers on another origin than the script. */
  hostUrl?: string;
}

/** GA4 property for the site. Public by nature — it ships in every page. */
const GA_MEASUREMENT_ID = "G-P44DRVCNGY";

/** Where the visitor's answer to the consent bar is remembered. */
const CONSENT_STORAGE_KEY = "heristop-consent";

const text = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

/** Undefined unless both halves are set: neither one alone can send a hit. */
const umamiConfig = (): UmamiConfig | undefined => {
  const scriptSrc = text(import.meta.env.UMAMI_SRC);
  const websiteId = text(import.meta.env.UMAMI_WEBSITE_ID);

  if (!scriptSrc || !websiteId) {
    return undefined;
  }

  return { scriptSrc, websiteId, hostUrl: text(import.meta.env.UMAMI_HOST_URL) };
};

/**
 * Umami wins over GA when both are configured, so a half-finished migration measures once rather
 * than twice.
 */
const analyticsMode = (): AnalyticsMode => {
  if (umamiConfig()) {
    return "umami";
  }

  return text(GA_MEASUREMENT_ID) ? "ga" : "none";
};

/**
 * Self-hosted Umami sets no cookie and stores no visitor identifier, so there is nothing to ask
 * about: in that mode the bar and the footer's way back to it are never rendered.
 *
 * Every other mode keeps the question — including `none`, where the answer still gates whatever the
 * page carries.
 */
const consentRequired = (): boolean => analyticsMode() !== "umami";

export { analyticsMode, consentRequired, umamiConfig, GA_MEASUREMENT_ID, CONSENT_STORAGE_KEY };
export type { AnalyticsMode, UmamiConfig };
