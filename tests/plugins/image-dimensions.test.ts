import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Element, Root } from "hast";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { imageDimensions } from "../../src/plugins/image-dimensions";

const img = (properties: Element["properties"]): Element => ({
  type: "element",
  tagName: "img",
  properties,
  children: [],
});

const tree = (...children: Element[]): Root => ({ type: "root", children });

describe("imageDimensions", () => {
  let publicDir = "";

  beforeAll(async () => {
    publicDir = mkdtempSync(join(tmpdir(), "image-dimensions-"));
    await sharp({ create: { width: 64, height: 32, channels: 3, background: "#fff" } })
      .png()
      .toFile(join(publicDir, "cover image.png"));
  });

  afterAll(() => {
    rmSync(publicDir, { recursive: true, force: true });
  });

  const run = (root: Root) => imageDimensions({ publicDir })(root);

  it("stamps the intrinsic size of a local file", async () => {
    const image = img({ src: "/cover%20image.png" });
    await run(tree(image));
    expect(image.properties).toMatchObject({ width: 64, height: 32 });
  });

  it("loads the first image eagerly and the rest lazily, all decoded async", async () => {
    const first = img({ src: "/cover%20image.png" });
    const second = img({ src: "/cover%20image.png" });
    await run(tree(first, second));
    expect(first.properties).toMatchObject({ loading: "eager", decoding: "async" });
    expect(first.properties.fetchpriority).toBeUndefined();
    expect(second.properties).toMatchObject({ loading: "lazy", decoding: "async" });
  });

  it("leaves remote images and explicit dimensions alone", async () => {
    const remote = img({ src: "https://example.dev/a.png" });
    const sized = img({ src: "/cover%20image.png", width: 10 });
    await run(tree(remote, sized));
    expect(remote.properties.width).toBeUndefined();
    expect(sized.properties).toMatchObject({ width: 10 });
    expect(sized.properties.height).toBeUndefined();
  });

  it("skips a missing file without failing the build", async () => {
    const missing = img({ src: "/nope.png" });
    await run(tree(missing));
    expect(missing.properties.width).toBeUndefined();
  });

  it("keeps an explicit loading attribute", async () => {
    const image = img({ src: "/cover%20image.png", loading: "lazy" });
    await run(tree(image));
    expect(image.properties.loading).toBe("lazy");
  });
});

describe("imageDimensions on raw HTML", () => {
  let publicDir = "";

  beforeAll(async () => {
    publicDir = mkdtempSync(join(tmpdir(), "image-dimensions-raw-"));
    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#000" } })
      .webp()
      .toFile(join(publicDir, "shot.webp"));
  });

  afterAll(() => {
    rmSync(publicDir, { recursive: true, force: true });
  });

  it("stamps size and loading onto an <img> written as raw HTML", async () => {
    const raw = {
      type: "raw",
      value: '<p><img src="/shot.webp" alt="shot" class="img-small" /></p>',
    };
    const root = { type: "root", children: [raw] } as unknown as Root;
    await imageDimensions({ publicDir })(root);
    expect(raw.value).toBe(
      '<p><img loading="eager" decoding="async" width="40" height="20" src="/shot.webp" alt="shot" class="img-small" /></p>',
    );
  });

  it("does not resize a raw <img> that already has a width", async () => {
    const raw = { type: "raw", value: '<img src="/shot.webp" width="10" loading="lazy">' };
    const root = { type: "root", children: [raw] } as unknown as Root;
    await imageDimensions({ publicDir })(root);
    expect(raw.value).toBe('<img decoding="async" src="/shot.webp" width="10" loading="lazy">');
  });
});
