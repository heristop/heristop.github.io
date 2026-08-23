// Audience measurement, decided from the env at build time.
//
// Astro renders components on the build machine, so the components read this
// directly: a page either carries the beacon or carries nothing.
//
// One tracker, and a cookieless one. Google Analytics and the self-hosted Umami
// option that briefly replaced it are both gone — with them went the consent
// bar, because a tracker that writes nothing on the visitor's device leaves a
// banner with no question to ask.

/** Where the visitor's answer to the old consent bar was remembered. */
const CONSENT_STORAGE_KEY = "heristop-consent";

const text = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Cloudflare Web Analytics token. Unset means no tag at all: taking the
 * configuration away is what switches measurement off, with nothing left
 * hardcoded to keep it alive.
 */
const cloudflareToken = (): string | undefined => text(import.meta.env.CLOUDFLARE_TOKEN);

export { cloudflareToken, CONSENT_STORAGE_KEY };
