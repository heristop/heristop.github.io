import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { mountFooterPortrait } from '../../src/components/client/footer-portrait';

const renderer = vi.hoisted(() => ({ draw: vi.fn(), resize: vi.fn() }));
vi.mock('../../src/components/client/footer-portrait-renderer', () => ({
  createPortraitRenderer: () => renderer,
}));

let visible: (entries: { isIntersecting: boolean }[]) => void;
let time = 0, id = 0;
const frames = new Map<number, FrameRequestCallback>();
const cleanups: (() => void)[] = [];
const disconnect = vi.fn();
const decode = vi.fn();
let reduced = false, finePointer = true;

beforeEach(() => {
  vi.clearAllMocks();
  frames.clear(); time = 0; id = 0; reduced = false; finePointer = true;
  vi.spyOn(performance, 'now').mockImplementation(() => time);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++id, fn); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') ? reduced : finePointer,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof visible) { visible = callback; }
    observe() {} disconnect = disconnect;
  });
  decode.mockResolvedValue(undefined);
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: decode });
  document.body.innerHTML = '<footer><a href="/about" aria-label="About me"><span data-footer-portrait><img src="/portrait.webp" alt=""><canvas hidden></canvas></span></a></footer>';
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 180, bottom: 180, width: 180, height: 180, toJSON() {},
  });
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '';
});

async function mount() {
  const element = document.querySelector<HTMLElement>('[data-footer-portrait]')!;
  cleanups.push(mountFooterPortrait(element));
  visible([{ isIntersecting: true }]);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  return element;
}
function advance() {
  for (let i = 0; i < 40; i++) {
    time += 1000 / 60;
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(time);
  }
}
const move = (x: number) => document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 70.2 }));

describe('Footer portrait integration', () => {
  it('ships actual transparent pixels around the character while preserving the neck', async () => {
    const { data, info } = await sharp('public/images/footer-portrait/portrait-transparent.webp').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => data[(Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) * 4 + 3];
    expect(alpha(.02,.02)).toBe(0);
    expect(alpha(.1,.4)).toBe(0);
    expect(alpha(.9,.4)).toBe(0);
    expect(alpha(.5,.565)).toBeGreaterThan(240);
  });
  it('follows the pointer outside the small avatar, keeps the About link and stops at rest', async () => {
    const element = await mount();
    move(700); advance();
    expect(renderer.draw).toHaveBeenLastCalledWith(1, 0);
    expect(frames.size).toBe(0);
    expect(element.querySelector('canvas')!.hidden).toBe(false);
    expect(element.closest('a')!.getAttribute('href')).toBe('/about');
    move(-100); advance();
    expect(renderer.draw).toHaveBeenLastCalledWith(-1, 0);
  });

  it('sleeps off screen and cancels listeners and animation on page navigation', async () => {
    await mount();
    move(700);
    expect(frames.size).toBe(1);
    visible([{ isIntersecting: false }]);
    expect(frames.size).toBe(0);
    renderer.draw.mockClear(); move(-100); advance();
    expect(renderer.draw).not.toHaveBeenCalled();
    visible([{ isIntersecting: true }]);
    cleanups.pop()!();
    expect(disconnect).toHaveBeenCalled();
    renderer.draw.mockClear(); move(700); advance();
    expect(renderer.draw).not.toHaveBeenCalled();
  });

  it.each(['reduced motion', 'touch'] as const)('keeps the image static for %s', async (mode) => {
    reduced = mode === 'reduced motion'; finePointer = mode !== 'touch';
    const element = await mount(); move(700); advance();
    expect(element.querySelector('img')!.hidden).toBe(false);
    expect(element.querySelector('canvas')!.hidden).toBe(true);
    expect(renderer.draw).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it('keeps the static drawing visible if an animation asset fails to load', async () => {
    decode.mockRejectedValue(new Error('unavailable'));
    const element = await mount();
    expect(element.querySelector('img')!.hidden).toBe(false);
    expect(element.querySelector('canvas')!.hidden).toBe(true);
  });
});
