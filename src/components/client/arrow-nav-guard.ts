/* Left/Right switch to the previous/next article, but only when nothing focused needs those keys
   itself: text fields move the caret, code blocks and diagrams scroll sideways, menus and
   dialogs move between their items, an article's video player seeks (WCAG 2.1.1 / 2.1.4) */
export const ARROW_KEY_OWNERS = [
  "input",
  "textarea",
  "select",
  "pre",
  "table",
  ".mermaid-wide",
  ".katex-display",
  "[contenteditable='true']",
  "[role='region']",
  "[role='menu']",
  "[role='menubar']",
  "[role='listbox']",
  "[role='slider']",
  "[role='tablist']",
  "[role='radiogroup']",
  "[role='dialog']",
  ".zen-video",
].join(", ");

export const arrowKeysOwnedByFocus = (element: Element | null): boolean => {
  if (element === null || element === element.ownerDocument.body) {
    return false;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    return true;
  }
  return element.closest(ARROW_KEY_OWNERS) !== null;
};

/** Whether a keydown may drive the article-level arrow navigation. */
export const mayNavigateWithArrows = (event: KeyboardEvent, focused: Element | null): boolean =>
  !event.defaultPrevented &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !event.shiftKey &&
  !arrowKeysOwnedByFocus(focused);
