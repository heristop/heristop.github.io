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

const isExternal = (url: string, domain: string) => url.startsWith("http") && !url.includes(domain);

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
      }
    });
  };
};
