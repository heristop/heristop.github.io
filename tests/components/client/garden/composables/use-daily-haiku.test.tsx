import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import useDailyHaiku, {
  parseZenDailyPoem,
  ZEN_DAILY_URL,
} from "../../../../../src/components/client/garden/composables/use-daily-haiku";

const verses = ["Morning on the pond", "A small bird crosses the sky", "The water is still"];
const caption = `Title\n\n~~~\nBook hints\n\n~~~\n\n${verses.join("\n")}\n\n~~~\nTranslations\n\n~~~\n#haiku`;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-10T12:00:00Z"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => caption }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("reads only the three original verses, including Windows line endings", () => {
  expect(parseZenDailyPoem(caption.replaceAll("\n", "\r\n"))).toEqual(verses);
});

it.each([
  "",
  "A commentary about the poem",
  "~~~\none\n~~~\nTwo lines\nonly\n~~~",
  caption.replace(verses[1], ""),
])("rejects empty or malformed daily text", (text) =>
  expect(parseZenDailyPoem(text)).toBeUndefined(),
);

it("preloads Zen Daily, then refreshes at the finale without changing the fallback while loading", async () => {
  const { result, rerender } = renderHook(({ finale }) => useDailyHaiku(finale), {
    initialProps: { finale: false },
  });
  expect(result.current).toBeUndefined();
  await act(async () => {});
  expect(result.current).toEqual(verses);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining(ZEN_DAILY_URL),
    expect.objectContaining({ cache: "no-store" }),
  );
  rerender({ finale: true });
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(result.current).toEqual(verses);
});

it.each(["network", "http", "invalid"])(
  "keeps the original poem available after a %s failure",
  async (failure) => {
    if (failure === "network") vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    else
      vi.mocked(fetch).mockResolvedValue({
        ok: failure !== "http",
        text: async () => "not a poem",
      } as Response);
    const { result } = renderHook(() => useDailyHaiku(false));
    await act(async () => {});
    expect(result.current).toBeUndefined();
  },
);

it("discards yesterday's poem at midnight instead of presenting it as today's daily", async () => {
  const { result, rerender } = renderHook(({ finale }) => useDailyHaiku(finale), {
    initialProps: { finale: false },
  });
  await act(async () => {});
  expect(result.current).toEqual(verses);
  vi.setSystemTime(new Date("2026-09-11T00:00:01Z"));
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  rerender({ finale: true });
  expect(result.current).toBeUndefined();
  await act(async () => {});
  expect(result.current).toBeUndefined();
});

it("aborts slow requests and ignores a response after the timeout", async () => {
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result } = renderHook(() => useDailyHaiku(false));
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  act(() => vi.advanceTimersByTime(5000));
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ ok: true, text: async () => caption } as Response));
  expect(result.current).toBeUndefined();
});
