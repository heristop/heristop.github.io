/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Self-hosted Umami. Both together switch analytics away from Google Analytics and take the
   * cookie bar off the site — see src/analytics.ts. Read on the build machine only: the values
   * reach the page because the tag is rendered with them, not because the client can read the env.
   */
  readonly UMAMI_SRC?: string;
  readonly UMAMI_WEBSITE_ID?: string;
  /** Only when the collect API answers on another origin than the script. */
  readonly UMAMI_HOST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
