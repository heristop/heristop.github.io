// Touch browsers fire :hover on tap and keep it until the next tap elsewhere, so a lifted card or
// a tinted button stays "stuck" after the finger has gone. Gating every :hover selector behind
// `@media (hover: hover)` keeps hover for mice and trackpads and leaves touch to the :active
// press states in _touch.scss. Doing it at build time covers Sass partials and Astro scoped
// styles alike, instead of hand-wrapping some hundred rules and missing the next one.
//
// Typed structurally: PostCSS is Vite's dependency, not this project's, and only this much of
// its node API is used.

interface CssContainer {
  type: string;
  name?: string;
  params?: string;
  parent?: CssContainer | undefined;
}

interface CssAtRule extends CssContainer {
  append: (node: CssRule) => void;
}

interface CssRule extends CssContainer {
  selectors: string[];
  clone: (overrides: { selectors: string[] }) => CssRule;
  before: (node: CssContainer) => void;
}

interface PluginHelpers {
  AtRule: new (defaults: { name: string; params: string }) => CssAtRule;
}

const HOVER = /:hover\b/;
// A rule already scoped to an input type was written on purpose (including `(hover: none)`)
const INPUT_QUERY = /\b(any-)?hover\b|\b(any-)?pointer\b/;
export const HOVER_QUERY = "(hover: hover)";

export const splitHoverSelectors = (selectors: readonly string[]) => ({
  hover: selectors.filter((selector) => HOVER.test(selector)),
  rest: selectors.filter((selector) => !HOVER.test(selector)),
});

const isInputScoped = (node: CssContainer): boolean => {
  for (let current = node.parent; current; current = current.parent) {
    if (
      current.type === "atrule" &&
      current.name === "media" &&
      INPUT_QUERY.test(current.params ?? "")
    ) {
      return true;
    }
  }
  return false;
};

export const hoverMedia = () => ({
  postcssPlugin: "hover-media",
  Rule(rule: CssRule, { AtRule }: PluginHelpers) {
    // Native nesting (`&:hover` inside a rule) is left alone: its parent carries the scope
    if (rule.parent?.type === "rule" || isInputScoped(rule)) {
      return;
    }
    const { hover, rest } = splitHoverSelectors(rule.selectors);
    if (hover.length === 0) {
      return;
    }
    // `.card:hover, .card:focus-within` keeps its keyboard half unconditionally
    if (rest.length > 0) {
      rule.before(rule.clone({ selectors: rest }));
    }
    rule.selectors = hover;
    const media = new AtRule({ name: "media", params: HOVER_QUERY });
    rule.before(media);
    media.append(rule);
  },
});

hoverMedia.postcss = true;
