const DISSOLVE_RADIUS = 80;
const DISSOLVE_RADIUS_SQ = DISSOLVE_RADIUS * DISSOLVE_RADIUS;
const DISSOLVE_OPACITY_FACTOR = 0.85;
const DISSOLVE_DRIFT_FACTOR = 0.6;
const DISSOLVE_ROTATION_FACTOR = 0.4;
const DISSOLVE_SCALE_FACTOR = 0.08;
const DISSOLVE_BLUR_MAX = 0.6;
const DISSOLVE_EASE_POWER = 1.5;
const DISSOLVE_TRANSITION =
  "opacity 120ms ease, transform 120ms ease, filter 120ms ease, color 120ms ease";
const RECOVER_TRANSITION =
  "opacity 650ms var(--zen-ease-spring), transform 650ms var(--zen-ease-spring), filter 650ms var(--zen-ease-spring), color 650ms var(--zen-ease-spring)";
const ACCENT_COLOR = "#c2185b";
const DISSOLVE_COLOR_PCT_MAX = 60;
const COLOR_FULL = 100;
const COLOR_CACHE = new Map<number, string>();

interface Point {
  px: number;
  py: number;
}

interface CharCacheEntry {
  driftR: number;
  driftX: number;
  driftY: number;
  px: number;
  py: number;
}

const applyDissolveToElement = (el: HTMLSpanElement, intensity: number, driftX: number, driftY: number, driftR: number) => {
  const eased = intensity ** DISSOLVE_EASE_POWER;
  const scale = 1 - eased * DISSOLVE_SCALE_FACTOR;
  const colorPct = Math.round(eased * DISSOLVE_COLOR_PCT_MAX);

  let cachedColor = COLOR_CACHE.get(colorPct);
  if (!cachedColor) {
    cachedColor = `color-mix(in oklch, currentColor ${COLOR_FULL - colorPct}%, ${ACCENT_COLOR} ${colorPct}%)`;
    COLOR_CACHE.set(colorPct, cachedColor);
  }

  el.style.opacity = `${1 - eased * DISSOLVE_OPACITY_FACTOR}`;
  el.style.transform = `translate(${driftX * eased * DISSOLVE_DRIFT_FACTOR}px, ${driftY * eased * DISSOLVE_DRIFT_FACTOR}px) rotate(${driftR * eased * DISSOLVE_ROTATION_FACTOR}deg) scale(${scale})`;
  el.style.filter = `blur(${eased * DISSOLVE_BLUR_MAX}px)`;
  el.style.color = cachedColor;
  el.style.transition = DISSOLVE_TRANSITION;
};

const resetElement = (el: HTMLSpanElement) => {
  el.style.opacity = "1";
  el.style.transform = "translate(0, 0) rotate(0deg) scale(1)";
  el.style.filter = "blur(0)";
  el.style.color = "";
  el.style.transition = RECOVER_TRANSITION;
};

interface CharEntryContext {
  cached: CharCacheEntry;
  charElsRef: React.RefObject<Map<string, HTMLSpanElement>>;
  dissolvedKeys: React.RefObject<Set<string>>;
  key: string;
  mouseX: number;
  mouseY: number;
  nextDissolved: Set<string>;
}

const processCharEntry = (ctx: CharEntryContext) => {
  const {
    key,
    cached,
    mouseX,
    mouseY,
    charElsRef,
    dissolvedKeys,
    nextDissolved,
  } = ctx;
  const deltaX = mouseX - cached.px;
  const deltaY = mouseY - cached.py;
  const distSq = deltaX * deltaX + deltaY * deltaY;

  if (distSq >= DISSOLVE_RADIUS_SQ) {
    if (dissolvedKeys.current.has(key)) {
      const el = charElsRef.current.get(key);
      if (el) {
        resetElement(el);
      }
    }
    return;
  }

  const el = charElsRef.current.get(key);
  if (!el) {
    return;
  }
  const intensity = 1 - Math.sqrt(distSq) / DISSOLVE_RADIUS;
  applyDissolveToElement(el, intensity, cached.driftX, cached.driftY, cached.driftR);
  nextDissolved.add(key);
};

const getHaikuCharClass = (
  reducedMotion: boolean,
  breathing: boolean,
  appeared: boolean,
): string => {
  if (reducedMotion) {
    return "";
  }
  if (breathing) {
    return "haiku-char--breathe";
  }
  if (appeared) {
    return "haiku-char--appear";
  }
  return "haiku-char--smoke";
};

const haikuDissolve = {
  applyDissolveToElement,
  getHaikuCharClass,
  processCharEntry,
  resetElement,
};

export default haikuDissolve;
export type { CharCacheEntry, CharEntryContext, Point };
