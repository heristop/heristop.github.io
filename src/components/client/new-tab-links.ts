/* Links that open a new tab say so (WCAG 3.2.5 advisory, G201): each target="_blank" link is
   described by one shared hidden hint, which works whether the link is named by its text or by an
   aria-label. A hidden node still counts once aria-describedby points at it. */
export const NEW_TAB_HINT_ID = "new-tab-hint";
export const NEW_TAB_HINT_TEXT = "Opens in a new tab";

const ensureHint = (doc: Document): void => {
  if (doc.getElementById(NEW_TAB_HINT_ID) !== null) {
    return;
  }
  const hint = doc.createElement("span");
  hint.id = NEW_TAB_HINT_ID;
  hint.hidden = true;
  hint.textContent = NEW_TAB_HINT_TEXT;
  doc.body.append(hint);
};

/** Points every new-tab link at the hint; returns how many links it newly described. */
export const describeNewTabLinks = (doc: Document = document): number => {
  const links = doc.querySelectorAll('a[target="_blank"]');
  if (links.length === 0) {
    return 0;
  }
  ensureHint(doc);
  let described = 0;
  for (const link of links) {
    const ids = (link.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
    if (ids.includes(NEW_TAB_HINT_ID)) {
      continue;
    }
    link.setAttribute("aria-describedby", [...ids, NEW_TAB_HINT_ID].join(" "));
    described += 1;
  }
  return described;
};
