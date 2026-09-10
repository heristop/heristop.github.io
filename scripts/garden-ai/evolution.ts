import {
  createRng,
  GARDENER_WEIGHT_BOUNDS,
  resolveGardenerWeights,
  type GardenerWeights,
} from "../../src/components/client/garden/headless";

interface Options {
  initial: Readonly<GardenerWeights>;
  seed: number;
  population: number;
  generations: number;
  evaluate: (weights: GardenerWeights) => number;
  onGeneration?: (progress: { generation: number; fitness: number; evaluations: number }) => void;
}
export function evolveGardener(options: Options) {
  if (!Number.isInteger(options.population) || options.population < 4 || options.population > 64)
    throw new Error("population must be an integer between 4 and 64");
  if (
    !Number.isInteger(options.generations) ||
    options.generations < 1 ||
    options.generations > 100
  )
    throw new Error("generations must be an integer between 1 and 100");
  const rng = createRng(options.seed);
  const genes = Object.keys(GARDENER_WEIGHT_BOUNDS) as (keyof GardenerWeights)[];
  const bounded = (weights: GardenerWeights) =>
    resolveGardenerWeights(Object.fromEntries(genes.map((key) => [key, +weights[key].toFixed(4)])));
  const random = () =>
    bounded(
      Object.fromEntries(
        genes.map((key) => {
          const [min, max] = GARDENER_WEIGHT_BOUNDS[key];
          return [key, min + rng() * (max - min)];
        }),
      ) as unknown as GardenerWeights,
    );
  const cache = new Map<string, number>();
  const rank = (weights: GardenerWeights) => {
    const key = JSON.stringify(genes.map((gene) => weights[gene]));
    let fitness = cache.get(key);
    if (fitness === undefined) {
      fitness = options.evaluate({ ...weights });
      if (!Number.isFinite(fitness)) throw new Error("fitness must be finite");
      cache.set(key, fitness);
    }
    return { weights, fitness };
  };
  let population = [
    bounded({ ...options.initial }),
    ...Array.from({ length: options.population - 1 }, random),
  ]
    .map(rank)
    .sort((a, b) => b.fitness - a.fitness);
  const history: number[] = [];
  for (let generation = 0; generation < options.generations; generation++) {
    if (generation > 0) {
      const tournament = () =>
        Array.from({ length: 3 }, () => population[Math.floor(rng() * population.length)]).sort(
          (a, b) => b.fitness - a.fitness,
        )[0].weights;
      const next = population.slice(0, 2).map((candidate) => ({ ...candidate.weights }));
      while (next.length < options.population) {
        const a = tournament(),
          b = tournament();
        const child = { ...a };
        for (const key of genes) {
          const [min, max] = GARDENER_WEIGHT_BOUNDS[key];
          child[key] = rng() < 0.5 ? a[key] : b[key];
          if (rng() < 0.3) child[key] += (rng() + rng() + rng() - 1.5) * (max - min) * 0.25;
        }
        next.push(bounded(child));
      }
      population = next.map(rank).sort((a, b) => b.fitness - a.fitness);
    }
    history.push(population[0].fitness);
    options.onGeneration?.({
      generation: generation + 1,
      fitness: population[0].fitness,
      evaluations: cache.size,
    });
  }
  return { ...population[0], evaluations: cache.size, history };
}
