import { expect, it } from "vitest";
import { evolveGardener } from "../../scripts/garden-ai/evolution";
import {
  DEFAULT_GARDENER_WEIGHTS,
  GARDENER_WEIGHT_BOUNDS,
} from "../../src/components/client/garden/headless";

it("evolves bounded settings reproducibly, preserving the best through every generation", () => {
  const seen: number[] = [];
  const evaluate = (weights: typeof DEFAULT_GARDENER_WEIGHTS) =>
    -Math.abs(weights.pressure - 2.5) - Math.abs(weights.walking - 0.3) * 10;
  const options = {
    seed: 42,
    population: 8,
    generations: 6,
    initial: DEFAULT_GARDENER_WEIGHTS,
    evaluate,
  };
  const first = evolveGardener({ ...options, onGeneration: ({ fitness }) => seen.push(fitness) });
  const second = evolveGardener(options);
  expect(first).toEqual(second);
  expect(first.fitness).toBeGreaterThan(evaluate(DEFAULT_GARDENER_WEIGHTS));
  expect(first.evaluations).toBeGreaterThan(8);
  expect(seen.every((score, i) => !i || score >= seen[i - 1])).toBe(true);
  for (const [key, [min, max]] of Object.entries(GARDENER_WEIGHT_BOUNDS)) {
    expect(first.weights[key as keyof typeof first.weights]).toBeGreaterThanOrEqual(min);
    expect(first.weights[key as keyof typeof first.weights]).toBeLessThanOrEqual(max);
  }
});

it("rejects invalid runs and non-finite fitness rather than selecting a broken profile", () => {
  const options = {
    seed: 42,
    population: 4,
    generations: 1,
    initial: DEFAULT_GARDENER_WEIGHTS,
    evaluate: () => NaN,
  };
  expect(() => evolveGardener(options)).toThrow(/finite/);
  expect(() => evolveGardener({ ...options, population: 0 })).toThrow(/population/);
  expect(() => evolveGardener({ ...options, generations: 0 })).toThrow(/generations/);
});

it("refuses to promote a high-scoring profile that breaks difficulty or movement limits", async () => {
  const { summarizeRuns, promotionFailures } = await import("../../scripts/garden-ai/evaluation");
  const reference = {
    ...summarizeRuns([]),
    games: 3,
    boards: 1,
    wins: 3,
    winRates: { economical: 1, nearby: 1, lookahead: 1 },
    averageRounds: 4,
    averageGardenerSteps: 10,
    averageBends: 5,
    fitness: 80,
    planning: { decisions: 1, p50Ms: 1, p95Ms: 1, maxMs: 1 },
    runs: [],
  };
  expect(promotionFailures(reference, reference)).toEqual([]);
  const unsafe = {
    ...reference,
    unwinnableBoards: ["validation/steady/0"],
    earlyWins: 1,
    stalled: 1,
    winRates: { economical: 0.5, nearby: 0.5, lookahead: 0.5 },
    averageRounds: 2,
    averageGardenerSteps: 20,
    fitness: 100,
  };
  expect(promotionFailures(unsafe, reference)).toEqual([
    "No tested strategy wins on some boards",
    "Early wins or unfinished simulations",
    "Too many losses for the planning player",
    "Difficulty increased too far",
    "Games became too short",
    "Movement or repetition regressed",
  ]);
  expect(promotionFailures({ ...reference, fitness: 79 }, reference)).toEqual([
    "Held-out quality score regressed",
  ]);
});

it("counts a blocked player strategy as a loss, reserving stall failures for simulation loops", async () => {
  const { summarizeRuns } = await import("../../scripts/garden-ai/evaluation");
  const base = {
    scenario: "validation/steady/0",
    strategy: "nearby" as const,
    won: false,
    position: { posX: 2, posY: 2 },
    stonesFound: 3,
    steps: 30,
    laid: 8,
    refills: 3,
    attacks: 1,
    actions: 50,
    firstRoundStones: 0,
    stolen: 1,
    supplyLeft: 0,
    phase: "player" as const,
    gardenerSteps: 20,
    rakes: 6,
    bends: 5,
    repeats: 0,
    termination: "strategy-blocked" as const,
  };
  const summary = summarizeRuns([
    base,
    { ...base, strategy: "lookahead", won: true, termination: "won" },
  ]);
  expect(summary.stalled).toBe(0);
  expect(summary.winRates.nearby).toBe(0);
  expect(summary.unwinnableBoards).toEqual([]);
  expect(summarizeRuns([{ ...base, actions: 800, termination: "action-limit" }]).stalled).toBe(1);
});

it("keeps generated training gardens out of validation and the final audit", async () => {
  const { scenarios } = await import("../../scripts/garden-ai/simulation");
  const fingerprint = (scenario: ReturnType<typeof scenarios>[number]) =>
    JSON.stringify(
      scenario.layout.map.map((tile) => [
        tile.posX,
        tile.posY,
        tile.sprite,
        tile.stone,
        tile.decor,
      ]),
    );
  const training = scenarios("training", 1);
  const validation = scenarios("validation", 1);
  const audit = scenarios("audit", 1);
  const trainingMaps = new Set(training.map(fingerprint));
  expect(training.every((scenario) => !scenario.id.includes("published"))).toBe(true);
  expect(validation.every((scenario) => !trainingMaps.has(fingerprint(scenario)))).toBe(true);
  const seen = new Set([...training, ...validation].map(fingerprint));
  expect(audit.every((scenario) => !seen.has(fingerprint(scenario)))).toBe(true);
});
