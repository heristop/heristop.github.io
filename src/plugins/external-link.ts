import type { Element } from "hast";
import type { RehypePlugin } from "@astrojs/markdown-remark";
import { visit } from "unist-util-visit";

interface Options {
  domain: string;
}

const isAnchor = (element: Element) =>
  element.tagName === "a" &&
  element.properties !== undefined &&
  element.properties !== null &&
  "href" in element.properties;

const getUrl = (element: Element) => {
  if (element.properties === undefined || element.properties === null) {
    return "";
  }

  const url = element.properties["href"];

  if (url === undefined || url === null) {
    return "";
  }

  return url.toString();
};

// Compares hostnames: a substring test let `https://other.dev/?ref=heristop.github.io` pass as
// internal. An empty domain keeps the old meaning of "nothing is external".
const isExternal = (url: string, domain: string) => {
  if (!domain || !/^https?:\/\//.test(url)) {
    return false;
  }
  try {
    const { hostname } = new URL(url);
    return hostname !== domain && !hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
};

export const externalLink: RehypePlugin = (options?: Options) => {
  const siteDomain = options?.domain ?? "";

  return (tree) => {
    visit(tree, "element", (element: Element) => {
      if (!isAnchor(element)) {
        return;
      }

      const url = getUrl(element);

      if (
        isExternal(url, siteDomain) &&
        element.properties !== undefined &&
        element.properties !== null
      ) {
        element.properties["target"] = "_blank";
        // noopener only: noreferrer would hide this site from the referrer the linked pages see
        element.properties["rel"] = ["noopener"];
      }
    });
  };
};
