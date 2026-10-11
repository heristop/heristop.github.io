import type { Page } from "@playwright/test";

export type Theme = "light" | "dark";

/* Mirrors THEME_STORAGE_KEY in src/components/client/theme-preference.ts */
export const THEME_STORAGE_KEY = "theme-preference";

/* Midday, so BaseHead's daypart wash (dawn/dusk) never shows */
export const FROZEN_NOW = "2026-06-15T12:00:00+02:00";

const AXE_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/* Parts that change between runs or days: masked in screenshots */
export const VOLATILE_SELECTORS = [
  ".haiku-card__visual",
  ".haiku-card__content",
  ".haiku-skeleton",
  "time",
  ".blog-card__date-relative",
  ".post-page__date",
];

/* Volatile layers that sit under or over real content (the full-viewport petals, the footer ink
   landscape behind the footer text): a mask would paint over that content, so they are hidden */
const HIDDEN_LAYERS = [".sakura-layer", ".footer-scene__canvas"];

/* Dev-only chrome that never ships */
const DEV_ONLY = ["astro-dev-toolbar", "vite-error-overlay"];

const FIXED_HAIKU = "Moss on the stone path\nthe pilgrim counts every step\nevening comes slowly";
/* 1x1 transparent PNG: the haiku card image has fixed width/height attributes */
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Fixes everything a run would otherwise vary: the clock, Math.random, the stored theme and
 * the daily haiku fetched from GitHub. Call before the first navigation.
 */
export async function preparePage(page: Page, theme: Theme): Promise<void> {
  await page.clock.setFixedTime(new Date(FROZEN_NOW));
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript(
    ({ key, value }) => {
      try {
        if (value === "light") {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
      } catch {
        /* storage blocked: the default (light) applies */
      }
      // Seeded PRNG (mulberry32) so petal and ink jitter is the same every run
      let seed = 0x5eed;
      Math.random = () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
      };
    },
    { key: THEME_STORAGE_KEY, value: theme },
  );
  await page.route(/raw\.githubusercontent\.com\/heristop\/gutenku\//, (route) => {
    const url = route.request().url();
    if (url.includes("description.txt")) {
      return route.fulfill({ status: 200, contentType: "text/plain", body: FIXED_HAIKU });
    }
    return route.fulfill({ status: 200, contentType: "image/png", body: BLANK_PNG });
  });
}

/**
 * Loads a route and waits until it is visually settled: fonts ready, every lazy image and
 * `client:visible` island reached by scrolling once to the bottom, then back to the top.
 */
export async function gotoSettled(page: Page, path: string): Promise<number | undefined> {
  const response = await page.goto(path, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.8, 200);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 30)));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // The scroll-through toggles scroll-driven chrome (the TOC rail fades in and out): let those
  // finite transitions finish before anything is measured
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every(
            (animation) =>
              animation.playState !== "running" ||
              animation.effect?.getComputedTiming().endTime === Number.POSITIVE_INFINITY,
          ),
      undefined,
      { timeout: 5_000 },
    )
    .catch(() => undefined);
  await page
    .waitForFunction(
      () =>
        [...document.images].every((img) => img.complete),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  await page.addStyleTag({
    content: `${DEV_ONLY.join(",")}{display:none!important} ${HIDDEN_LAYERS.join(",")}{visibility:hidden!important} html{scroll-behavior:auto!important}`,
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return response?.status();
}

let axeSource: Promise<string> | undefined;
const loadAxe = (): Promise<string> => {
  axeSource ??= fetch(AXE_URL).then((res) => {
    if (!res.ok) {
      throw new Error(`axe-core download failed: ${res.status}`);
    }
    return res.text();
  });
  return axeSource;
};

export interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: string[];
}

/** Runs axe-core (WCAG 2.2 AA + best practices) on the current page */
export async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({ content: await loadAxe() });
  return page.evaluate(
    async ({ tags, exclude }) => {
      // oxlint-disable-next-line typescript/no-explicit-any
      const axe = (globalThis as any).axe;
      const result = await axe.run(
        { exclude: exclude.map((selector: string) => [selector]) },
        { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] },
      );
      // oxlint-disable-next-line typescript/no-explicit-any
      return result.violations.map((v: any) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        // oxlint-disable-next-line typescript/no-explicit-any
        nodes: v.nodes.slice(0, 5).map((n: any) => n.target.join(" ")),
      }));
    },
    { tags: AXE_TAGS, exclude: DEV_ONLY },
  );
}

/** Tag names of the headings in document order, `role="heading"` included */
export async function headingOrder(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading']")]
      .filter((el) => !el.closest("[hidden], [aria-hidden='true'], template, astro-dev-toolbar"))
      .map((el) =>
        el.getAttribute("role") === "heading"
          ? `h${el.getAttribute("aria-level") ?? "2"}`
          : el.tagName.toLowerCase(),
      ),
  );
}

export interface SmallTarget {
  selector: string;
  width: number;
  height: number;
}

/**
 * WCAG 2.5.8 (Target Size, Minimum): every visible pointer target is at least 24x24 CSS px.
 * Exempt, as the criterion allows: links inline in a sentence, and targets whose 24px circle
 * does not overlap a neighbouring target (the spacing exception).
 */
export async function smallTapTargets(page: Page, min = 24): Promise<SmallTarget[]> {
  return page.evaluate((minSize) => {
    const selector =
      "a[href], button, input:not([type='hidden']), select, textarea, summary, label[for], [role='button'], [role='link'], [role='tab'], [role='checkbox'], [role='switch'], [tabindex]:not([tabindex='-1'])";
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") {
        return false;
      }
      if (el.closest("[inert], [aria-hidden='true'], astro-dev-toolbar")) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };
    const inlineInText = (el: Element) => {
      if (getComputedStyle(el).display !== "inline") {
        return false;
      }
      const block = el.parentElement?.closest("p, li, dd, td, blockquote, figcaption, span");
      if (!block) {
        return false;
      }
      const ownText = (el.textContent ?? "").trim().length;
      return (block.textContent ?? "").trim().length > ownText;
    };
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
      const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${cls}${label ? ` "${label}"` : ""}`;
    };

    const targets = [...document.querySelectorAll(selector)].filter(visible);
    const rects = targets.map((el) => el.getBoundingClientRect());
    const small: { selector: string; width: number; height: number }[] = [];

    targets.forEach((el, i) => {
      const rect = rects[i];
      if (rect.width >= minSize - 0.5 && rect.height >= minSize - 0.5) {
        return;
      }
      if (inlineInText(el)) {
        return;
      }
      // Spacing exception: a 24px circle centred on the target must not touch another target
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const crowded = rects.some((other, j) => {
        if (j === i || targets[j].contains(el) || el.contains(targets[j])) {
          return false;
        }
        const nx = Math.max(other.left, Math.min(cx, other.right));
        const ny = Math.max(other.top, Math.min(cy, other.bottom));
        return Math.hypot(nx - cx, ny - cy) < minSize / 2;
      });
      if (crowded) {
        small.push({ selector: describe(el), width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    });
    return small;
  }, min);
}

/**
 * Under reduced motion every reveal must already be at rest: the ink reveal leaves no image
 * pending or drawing, and the page heading (the text reveal) and its letters are fully opaque
 * and untransformed, with no finite animation still running in the page content.
 */
export async function unsettledReveals(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const img of document.querySelectorAll("[data-ink]")) {
      problems.push(`ink ${img.getAttribute("data-ink")}: ${(img as HTMLImageElement).src?.split("/").pop()}`);
    }
    const h1 = document.querySelector("h1");
    if (h1) {
      for (const el of [h1, ...h1.querySelectorAll("*")]) {
        const style = getComputedStyle(el);
        if (Number.parseFloat(style.opacity) < 1 || style.visibility === "hidden") {
          problems.push(`h1 ${el.tagName.toLowerCase()} opacity ${style.opacity} ${style.visibility}`);
          break;
        }
        if (style.transform !== "none" && el !== h1) {
          problems.push(`h1 ${el.tagName.toLowerCase()} transform ${style.transform}`);
          break;
        }
      }
    }
    const content = document.querySelector("main") ?? document.body;
    for (const animation of document.getAnimations()) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const timing = animation.effect?.getComputedTiming();
      // Transitions are state changes (hover, scroll-driven chrome), not reveals
      if (
        !(animation instanceof CSSTransition) &&
        animation.playState === "running" &&
        target instanceof Element &&
        content.contains(target) &&
        timing?.endTime !== Number.POSITIVE_INFINITY
      ) {
        const name = animation instanceof CSSAnimation ? animation.animationName : "script";
        problems.push(`running ${name} on ${target.tagName.toLowerCase()}.${String(target.className).split(" ")[0]}`);
      }
    }
    return problems;
  });
}
