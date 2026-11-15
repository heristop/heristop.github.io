import { afterEach, describe, expect, it, vi } from "vitest";
import gutenku from "../../../src/components/client/gutenku-daily-api";

const { dailyHaikuUrl, fetchDailyHaiku, parseDailyHaiku, toHaikuSource } = gutenku;

const originalFetch = globalThis.fetch;
const URL_ = "https://gutenku.test/api/daily-haiku";

const PAYLOAD = {
  book: { author: "Friedrich Wilhelm Nietzsche", emoticons: "📜🧔‍♂️🏔️☀️⚡", title: "Thus Spake Zarathustra" },
  cardUrl: "https://gutenku.test/api/daily-haiku/card.jpg?d=2026-10-23&v=1792791955259",
  date: "2026-10-23",
  nextRolloverAt: "2026-10-24T10:00:00.000Z",
  publishedAt: "2026-10-23T21:45:55.259Z",
  reading: "This haiku juxtaposes radiance, longing, and abrupt sound.",
  title: "Gilded Joy, Sudden Cry",
  verses: ["the golden marvel", "longeth thy smiling for tears", "the spontaneous bark"],
};

const mockFetch = (impl: (input: string, init?: RequestInit) => Promise<unknown>) => {
  const fn = vi.fn(impl);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dailyHaikuUrl", () => {
  it("defaults to the production GutenKu server", () => {
    expect(dailyHaikuUrl("")).toBe("https://gutenku.xyz/api/daily-haiku");
    expect(dailyHaikuUrl(undefined)).toBe("https://gutenku.xyz/api/daily-haiku");
  });

  it("mounts the route under a configured base, trailing slash or not", () => {
    expect(dailyHaikuUrl("http://localhost:4000")).toBe("http://localhost:4000/api/daily-haiku");
    expect(dailyHaikuUrl(" http://localhost:4000/ ")).toBe("http://localhost:4000/api/daily-haiku");
  });
});

describe("fetchDailyHaiku", () => {
  it("returns today's haiku on success", async () => {
    const fn = mockFetch(() => Promise.resolve({ json: async () => PAYLOAD, ok: true, status: 200 }));
    const haiku = await fetchDailyHaiku(URL_);
    expect(haiku).toMatchObject({
      book: PAYLOAD.book,
      cardUrl: PAYLOAD.cardUrl,
      reading: PAYLOAD.reading,
      title: PAYLOAD.title,
      verses: PAYLOAD.verses,
    });
    expect(haiku?.nextRolloverAt?.toISOString()).toBe("2026-10-24T10:00:00.000Z");
    expect(fn).toHaveBeenCalledWith(URL_, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("misses on a 404, before anything is published", async () => {
    mockFetch(() => Promise.resolve({ json: async () => ({ error: "not_found" }), ok: false, status: 404 }));
    await expect(fetchDailyHaiku(URL_)).resolves.toBeUndefined();
  });

  it("misses on a network error", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(fetchDailyHaiku(URL_)).resolves.toBeUndefined();
  });

  it("misses on a non-JSON answer, such as an SPA page served in its place", async () => {
    mockFetch(() =>
      Promise.resolve({ json: async () => JSON.parse("<!DOCTYPE html>") as unknown, ok: true, status: 200 }),
    );
    await expect(fetchDailyHaiku(URL_)).resolves.toBeUndefined();
  });

  it("aborts and misses once the timeout elapses", async () => {
    vi.useFakeTimers();
    const fn = mockFetch(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const pending = fetchDailyHaiku(URL_, { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(999);
    expect(fn.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeUndefined();
    expect(fn.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});

describe("parseDailyHaiku", () => {
  it("rejects payloads without a reading or a usable card", () => {
    expect(parseDailyHaiku(null)).toBeUndefined();
    expect(parseDailyHaiku({ ...PAYLOAD, book: undefined })).toBeUndefined();
    expect(parseDailyHaiku({ ...PAYLOAD, reading: "  " })).toBeUndefined();
    expect(parseDailyHaiku({ ...PAYLOAD, cardUrl: "/api/daily-haiku/card.jpg" })).toBeUndefined();
    // oxlint-disable-next-line no-script-url
    expect(parseDailyHaiku({ ...PAYLOAD, cardUrl: "javascript:alert(1)" })).toBeUndefined();
  });

  it("drops an unreadable rollover and stray verses", () => {
    const haiku = parseDailyHaiku({ ...PAYLOAD, nextRolloverAt: "soon", verses: ["one", 2, " ", "three"] });
    expect(haiku?.nextRolloverAt).toBeUndefined();
    expect(haiku?.verses).toEqual(["one", "three"]);
  });
});

describe("toHaikuSource", () => {
  it("maps the book, the emoticons, the title and the verses without parsing a caption", () => {
    const haiku = parseDailyHaiku(PAYLOAD);
    expect(haiku && toHaikuSource(haiku)).toEqual({
      author: "Friedrich Wilhelm Nietzsche",
      book: "Thus Spake Zarathustra",
      bookmoji: "📜🧔‍♂️🏔️☀️⚡",
      title: "Gilded Joy, Sudden Cry",
      verses: PAYLOAD.verses,
    });
  });

  it("leaves empty fields out so the note falls back to the riddle", () => {
    const haiku = parseDailyHaiku({
      ...PAYLOAD,
      book: { author: "", emoticons: "", title: "" },
      title: "",
      verses: ["only one"],
    });
    expect(haiku && toHaikuSource(haiku)).toEqual({
      author: undefined,
      book: undefined,
      bookmoji: undefined,
      title: undefined,
      verses: [],
    });
  });
});
