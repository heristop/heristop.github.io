import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { imageMetadata } from "astro/assets/utils";

export interface PublicImage {
  src: string;
  width?: number;
  height?: number;
}

// Post banners live in public/: there is no pipeline to resize them, so read their intrinsic size
// for the width/height attributes (the box is reserved, no layout shift) and let the browser
// downscale the lazy thumbnail. Memoised: several posts share one stock banner.
const sizes = new Map<string, Promise<PublicImage>>();

const read = async (src: string): Promise<PublicImage> => {
  if (!src.startsWith("/")) {
    return { src };
  }
  try {
    const { width, height } = await imageMetadata(
      await readFile(join(process.cwd(), "public", src)),
      src,
    );
    return { src, width, height };
  } catch {
    return { src };
  }
};

export const publicImage = (src: string): Promise<PublicImage> => {
  const cached = sizes.get(src) ?? read(src);
  sizes.set(src, cached);
  return cached;
};
