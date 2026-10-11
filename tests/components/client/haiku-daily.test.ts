import { describe, expect, it } from "vitest";
import daily from "../../../src/components/client/haiku-daily";

const { haikuDay, nextVerse, parseHaikuSource, splitLead } = daily;

const SOCIAL = `🌸  “Whispers in the Grove” 🗻

📚 Guess the book! 👇

~~~

💡 Hint 1 (Bookmoji):
📢🌪️⏳🧠💔

💡 Hint 2 (First letter of the book):
T...

📗 The sound and the fury by William Faulkner

~~~

eating by the branch
I listened to the water
The trees were buzzing

~~~

🇫🇷 En mangeant près de la branche
`;

describe("haikuDay", () => {
  it("splits today's local date for the eyebrow and the seal", () => {
    const day = haikuDay(new Date(2026, 9, 11, 9, 30));
    expect(day).toMatchObject({
      day: "11",
      dayMonth: "11 October",
      fullDate: "11 October 2026",
      iso: "2026-10-11",
      month: "Oct",
      weekday: "Sunday",
    });
  });
});

describe("nextVerse", () => {
  it("counts down to the next 10:00 UTC rollover", () => {
    const verse = nextVerse(new Date("2026-10-11T01:00:00Z"));
    expect(verse.label).toBe("Next verse in 9 h");
    expect(verse.progress).toBeCloseTo(15 / 24);
  });

  it("rolls to tomorrow once today's verse is out", () => {
    const verse = nextVerse(new Date("2026-10-11T10:00:00Z"));
    expect(verse.label).toBe("Next verse in 24 h");
    expect(verse.progress).toBeCloseTo(0);
  });

  it("switches to minutes in the last hour", () => {
    expect(nextVerse(new Date("2026-10-11T09:35:10Z")).label).toBe("Next verse in 25 min");
  });
});

describe("parseHaikuSource", () => {
  it("reads the title, the hint, the book and the verses", () => {
    expect(parseHaikuSource(SOCIAL)).toEqual({
      author: "William Faulkner",
      book: "The Sound and the Fury",
      bookmoji: "📢🌪️⏳🧠💔",
      title: "Whispers in the Grove",
      verses: ["eating by the branch", "I listened to the water", "The trees were buzzing"],
    });
  });

  it("returns nothing it cannot find", () => {
    expect(parseHaikuSource("just a line")).toEqual({
      author: undefined,
      book: undefined,
      bookmoji: undefined,
      title: undefined,
      verses: [],
    });
  });
});

describe("splitLead", () => {
  it("lifts the first sentence out of the reading", () => {
    expect(splitLead("A quiet meal. The forest hums back.")).toEqual({
      body: "The forest hums back.",
      lead: "A quiet meal.",
    });
  });

  it("keeps a single sentence as the body", () => {
    expect(splitLead("old pond / a frog jumps in")).toEqual({ body: "old pond / a frog jumps in" });
  });
});
