import "./register.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
const { scenarios } = await import("./simulation.ts");
const { evolveGardener } = await import("./evolution.ts");
const { evaluateGardener, weightedGardener, promotionFailures } = await import("./evaluation.ts");
const legacy = await import("./legacy.ts");
const { DEFAULT_GARDENER_WEIGHTS } = await import("../../src/components/client/garden/headless");

const args = process.argv.slice(2);
const value = (name, fallback) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const integer = (name, fallback, min, max) => {
  const n = Number(value(name, fallback));
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`--${name} must be between ${min} and ${max}`);
  return n;
};
const population = integer("population", 12, 4, 64);
const generations = integer("generations", 8, 1, 100);
const seed = integer("seed", 731, 0, 4294967295);
const evolve = !args.includes("--evaluate-only");
const split = args.includes("--audit") ? "audit" : "validation";
if (args.includes("--apply") && !evolve) throw new Error("--apply requires an evolutionary run");
if (split === "audit" && evolve) throw new Error("--audit is reserved for --evaluate-only");
const training = evolve ? scenarios("training", integer("training-variants", 1, 1, 20)) : [];
const validation = scenarios(split, integer("validation-variants", 2, 1, 100));
const initial = { ...DEFAULT_GARDENER_WEIGHTS };
const output = resolve(value("output", "/tmp/gardener-ai-report.json"));
const started = performance.now();
console.log(
  JSON.stringify({
    trainingBoards: training.length,
    validationBoards: validation.length,
    population,
    generations,
    seed,
    evolve,
  }),
);
const champion = evolve
  ? evolveGardener({
      initial,
      population,
      generations,
      seed,
      evaluate: (weights) => evaluateGardener(training, weightedGardener(weights)).fitness,
      onGeneration: (progress) => console.log(JSON.stringify(progress)),
    })
  : { weights: initial, fitness: undefined, evaluations: 0, history: [] };
const reference = evaluateGardener(validation, weightedGardener(initial));
const candidate = evolve
  ? evaluateGardener(validation, weightedGardener(champion.weights))
  : reference;
const baseline = evaluateGardener(validation, {
  chooseTargets: legacy.chooseRakeTargets,
  planTurn: legacy.planGardenerTurn,
});
const failures = promotionFailures(candidate, evolve ? reference : baseline);
const report = {
  seed,
  population,
  generations,
  initial,
  champion,
  datasets: { training: training.map((s) => s.id), [split]: validation.map((s) => s.id) },
  baseline,
  reference,
  candidate,
  promotion: { eligible: failures.length === 0, failures, applied: false },
  elapsedMs: performance.now() - started,
};
if (args.includes("--apply")) {
  if (failures.length) process.exitCode = 1;
  else {
    writeFileSync(
      new URL("../../src/components/client/garden/board/gardener-profile.json", import.meta.url),
      JSON.stringify(champion.weights, null, 2) + "\n",
    );
    report.promotion.applied = true;
  }
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
for (const [name, result] of Object.entries({ baseline, reference, candidate })) {
  const { runs: _runs, ...summary } = result;
  console.log(JSON.stringify({ name, ...summary }));
}
console.log(JSON.stringify({ output, promotion: report.promotion, elapsedMs: report.elapsedMs }));
