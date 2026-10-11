import { createRequire } from "node:module";
import { join } from "node:path";
import type { Element, Root } from "hast";
import type Sharp from "sharp";
import { visit } from "unist-util-visit";

// Stamps the intrinsic width/height of local images (files under public/) onto markdown <img>, so
// the browser reserves their box before they load — no layout shift when they arrive. CSS keeps
// `height: auto`, so the attributes only fix the aspect ratio, never the rendered size.
//
// The first image of an article is loaded eagerly; the rest are lazy. It is not given
// fetchpriority="high": on these pages the header banner is the LCP element, and a second
// high-priority image would compete with it for bandwidth.

interface Options {
  publicDir: string;
}

type Size = { width: number; height: number } | undefined;

// Use the sharp Astro's image service loads, not the root's: the root pins an older sharp for the
// garden's sprite pipeline, and two sharp copies in one process load two libvips builds whose
// duplicate classes broke Astro's /_image endpoint in dev ("MissingSharp").
const astroRequire = createRequire(createRequire(import.meta.url).resolve("astro/package.json"));
const sharp = astroRequire("sharp") as typeof Sharp;

const isLocal = (src: string) => src.startsWith("/") && !src.startsWith("//");

const sizes = new Map<string, Promise<Size>>();

const readSize = (file: string): Promise<Size> => {
  let pending = sizes.get(file);
  if (!pending) {
    pending = sharp(file)
      .metadata()
      .then(({ width, height }) => (width && height ? { width, height } : undefined))
      .catch(() => undefined);
    sizes.set(file, pending);
  }
  return pending;
};

// Markdown that writes <img> as raw HTML reaches rehype as a string, not an element
const RAW_IMG = /<img\b[^>]*>/gi;
const rawAttribute = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];

// mdast-util-to-hast's passthrough node; not part of the hast types
interface Raw {
  type: "raw";
  value: string;
}

type Slot = { kind: "element"; element: Element } | { kind: "raw"; node: Raw; tag: string };

const imageDimensions = (options: Options) => async (tree: Root) => {
  const sizeFor = async (src: string | undefined) => {
    if (!src || !isLocal(src)) {
      return undefined;
    }
    return readSize(join(options.publicDir, decodeURIComponent(src.split(/[?#]/)[0])));
  };

  const slots: Slot[] = [];
  visit(tree, (node) => {
    if (node.type === "element" && node.tagName === "img") {
      slots.push({ kind: "element", element: node });
      return;
    }
    const raw = node as unknown as Raw;
    if (raw.type === "raw") {
      for (const tag of raw.value.match(RAW_IMG) ?? []) {
        slots.push({ kind: "raw", node: raw, tag });
      }
    }
  });

  await Promise.all(
    slots.map(async (slot, index) => {
      const loading = index === 0 ? "eager" : "lazy";

      if (slot.kind === "element") {
        const properties = slot.element.properties;
        properties.decoding ??= "async";
        properties.loading ??= loading;
        if (properties.width !== undefined || properties.height !== undefined) {
          return;
        }
        const size = await sizeFor(typeof properties.src === "string" ? properties.src : undefined);
        if (size) {
          properties.width = size.width;
          properties.height = size.height;
        }
        return;
      }

      const { tag } = slot;
      const added: string[] = [];
      if (rawAttribute(tag, "loading") === undefined) {
        added.push(`loading="${loading}"`);
      }
      if (rawAttribute(tag, "decoding") === undefined) {
        added.push(`decoding="async"`);
      }
      if (rawAttribute(tag, "width") === undefined && rawAttribute(tag, "height") === undefined) {
        const size = await sizeFor(rawAttribute(tag, "src"));
        if (size) {
          added.push(`width="${size.width}"`, `height="${size.height}"`);
        }
      }
      if (added.length > 0) {
        const stamped = tag.replace(/^<img\b/i, `<img ${added.join(" ")}`);
        slot.node.value = slot.node.value.replace(tag, stamped);
      }
    }),
  );
};

export { imageDimensions };
