import {
  chooseRakeTargets,
  planGardenerTurn,
  type GardenerWeights,
  type GardenerController,
} from "../../src/components/client/garden/headless";
import { simulate, strategies, type Scenario } from "./simulation";

export type Run = ReturnType<typeof simulate> & { scenario: string };
const mean = (values: number[]) =>
  values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
export function summarizeRuns(runs: readonly Run[]) {
  const boards = [...new Set(runs.map((run) => run.scenario))];
  const wins = runs.filter((run) => run.won);
  const winRates = Object.fromEntries(
    strategies.map((strategy) => {
      const selected = runs.filter((run) => run.strategy === strategy);
      return [
        strategy,
        selected.length ? selected.filter((run) => run.won).length / selected.length : 0,
      ];
    }),
  ) as Record<(typeof strategies)[number], number>;
  const summary = {
    games: runs.length,
    boards: boards.length,
    wins: wins.length,
    unwinnableBoards: boards.filter((id) => !runs.some((run) => run.scenario === id && run.won)),
    earlyWins: wins.filter(
      (run) => run.refills === 0 || (run.scenario === "validation/published/0" && run.refills < 2),
    ).length,
    stalled: runs.filter((run) => run.termination === "action-limit").length,
    blockedStrategies: runs.filter((run) => run.termination === "strategy-blocked").length,
    winRates,
    averageRounds: mean(wins.map((run) => run.refills + 1)),
    averagePlayerSteps: mean(wins.map((run) => run.steps)),
    averageGardenerSteps: mean(runs.map((run) => run.gardenerSteps)),
    averageBends: mean(runs.map((run) => run.bends)),
    averageRepeats: mean(runs.map((run) => run.repeats)),
    averageRakes: mean(runs.map((run) => run.rakes)),
  };
  // Difficulty is a target band. Winning as often as possible is not the objective.
  const fitness =
    100 -
    summary.unwinnableBoards.length * 1000 -
    summary.earlyWins * 100 -
    summary.stalled * 100 -
    12 * Math.abs(winRates.economical - 0.85) -
    8 * Math.abs(winRates.nearby - 0.65) -
    20 * Math.abs(winRates.lookahead - 1) -
    4 * Math.abs(summary.averageRounds - 3.5) -
    summary.averageGardenerSteps * 0.25 -
    summary.averageBends * 0.5 -
    summary.averageRepeats * 3;
  return { ...summary, fitness };
}
export type Evaluation = ReturnType<typeof evaluateGardener>;
export const weightedGardener = (weights: Readonly<GardenerWeights>): GardenerController => ({
  chooseTargets: (map, trail, player, turn, options) =>
    chooseRakeTargets(map, trail, player, turn, { ...options, weights }),
  planTurn: planGardenerTurn,
});
export function evaluateGardener(scenarios: readonly Scenario[], controller: GardenerController) {
  const planning: number[] = [];
  const timed: GardenerController = {
    ...controller,
    chooseTargets: (...args) => {
      const start = performance.now();
      const targets = controller.chooseTargets(...args);
      planning.push(performance.now() - start);
      return targets;
    },
  };
  const runs = scenarios.flatMap((scenario) =>
    strategies.map((strategy) => ({
      scenario: scenario.id,
      ...simulate(scenario.layout, strategy, timed),
    })),
  );
  planning.sort((a, b) => a - b);
  return {
    ...summarizeRuns(runs),
    planning: {
      decisions: planning.length,
      p50Ms: planning[Math.floor(planning.length * 0.5)] ?? 0,
      p95Ms: planning[Math.floor(planning.length * 0.95)] ?? 0,
      maxMs: planning.at(-1) ?? 0,
    },
    runs,
  };
}
export function promotionFailures(candidate: Evaluation, reference: Evaluation): string[] {
  const failures: string[] = [];
  if (candidate.unwinnableBoards.length) failures.push("No tested strategy wins on some boards");
  if (candidate.earlyWins || candidate.stalled)
    failures.push("Early wins or unfinished simulations");
  if (
    candidate.winRates.lookahead < reference.winRates.lookahead - 0.05 ||
    candidate.winRates.lookahead < 0.9
  )
    failures.push("Too many losses for the planning player");
  if (
    candidate.winRates.economical < reference.winRates.economical - 0.1 ||
    candidate.winRates.nearby < reference.winRates.nearby - 0.15
  )
    failures.push("Difficulty increased too far");
  if (candidate.averageRounds < reference.averageRounds - 0.25)
    failures.push("Games became too short");
  if (
    candidate.averageGardenerSteps > reference.averageGardenerSteps * 1.05 ||
    candidate.averageBends > reference.averageBends * 1.05 ||
    candidate.averageRepeats > reference.averageRepeats + 0.05
  )
    failures.push("Movement or repetition regressed");
  if (candidate.fitness < reference.fitness) failures.push("Held-out quality score regressed");
  return failures;
}
