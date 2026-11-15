/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Cloudflare Web Analytics token, and the only analytics configuration left. Cookieless, so no
   * consent bar is rendered; page views only, since the vendor has no event API.
   */
  readonly CLOUDFLARE_TOKEN?: string;
  /**
   * Base URL of the GutenKu server the daily haiku card reads from (`${base}/api/daily-haiku`).
   * Defaults to https://gutenku.xyz; set it to http://localhost:4000 to try a local server.
   */
  readonly PUBLIC_GUTENKU_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
