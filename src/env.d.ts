/// <reference types="astro/client" />

interface ImportMetaEnv {
  /**
   * Cloudflare Web Analytics token, and the only analytics configuration left. Cookieless, so no
   * consent bar is rendered; page views only, since the vendor has no event API.
   */
  readonly CLOUDFLARE_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
