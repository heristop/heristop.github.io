import { describe, expect, it } from "vitest";
import { isPublished } from "../../src/utils/post-visibility";

const now = new Date("2026-10-10T12:00:00Z");

describe("isPublished", () => {
  it("publishes a dated post from the past", () => {
    expect(isPublished({ pubDate: new Date("2026-09-06") }, now)).toBe(true);
  });

  it("publishes a post without a date", () => {
    expect(isPublished({}, now)).toBe(true);
  });

  it("holds back a draft, even when its date has passed", () => {
    expect(isPublished({ draft: true, pubDate: new Date("2020-01-01") }, now)).toBe(false);
  });

  it("holds back a post scheduled after the build", () => {
    expect(isPublished({ pubDate: new Date("2026-10-12") }, now)).toBe(false);
  });

  it("publishes a post dated exactly at build time", () => {
    expect(isPublished({ pubDate: now }, now)).toBe(true);
  });

  it("treats draft: false as published", () => {
    expect(isPublished({ draft: false, pubDate: new Date("2026-01-01") }, now)).toBe(true);
  });
});
