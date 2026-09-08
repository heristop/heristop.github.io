// What the garden thinks of how you crossed it.
//
// The scoring says one thing and says it three ways: restraint is the virtue. A dry
// garden is raked, and the whole conceit of the game is that you would rather not disturb
// it — so the stones you did NOT lay are worth far more than the speed you crossed at, and
// a walk that never breaks the sand at all is worth more than any amount of hurrying.
//
// Nothing here is a penalty. Every term is something earned and added, because a garden
// that scolds you for walking through it is not a garden anyone wants to walk through.

interface Walk {
  gardenerTurns?: number;
  steps: number;
  stonesLaid: number;
  stonesLeft: number;
  frogFreed?: boolean;
  catMet?: boolean;
}

interface ScoreLine {
  label: string;
  detail: string;
  points: number;
}

interface Score {
  rank: string;
  lines: readonly ScoreLine[];
  total: number;
}

const ARRIVAL_POINTS = 400;
const SPARED_STONE_POINTS = 120;
// A walk of about fifty steps still earns something; beyond that the bonus is gone rather
// than negative, because the slow visitor should not be punished for looking around.
const BRISK_ALLOWANCE = 300;
const STEP_COST = 6;
// She is worth more than a brisk walk and less than a stone unspent. Nobody is told she is
// there, so a walk that never finds her must not read as a walk done badly — the line
// simply does not appear.
const COURTESY_POINTS = 250;
// The cat asks for nothing and is therefore easy to walk straight past, which is exactly
// why stopping for him is worth something.
const COMPANY_POINTS = 150;
// And a bonus for both, because the point of the pair is that neither was on the way. A
// walk that went out of its way twice was not a walk about stones at all.
const GOOD_COMPANY_POINTS = 200;

const rankFor = (
  stonesLaid: number,
  budget: number,
  frogFreed: boolean,
  catMet: boolean,
): string => {
  if (frogFreed && catMet) {
    return stonesLaid === 0 ? "The sand undisturbed, and in good company" : "In good company";
  }
  if (frogFreed && stonesLaid === 0) {
    return "The sand undisturbed, and better company for it";
  }
  if (stonesLaid === 0) {
    return "The sand undisturbed";
  }
  if (budget === 0 || stonesLaid <= budget / 3) {
    return "Light of foot";
  }
  if (stonesLaid <= (budget * 2) / 3) {
    return "Measured";
  }
  return "Determined";
};

const scoreWalk = ({
  steps,
  gardenerTurns,
  stonesLaid,
  stonesLeft,
  frogFreed = false,
  catMet = false,
}: Walk): Score => {
  const replenished = (gardenerTurns ?? 0) * 2;
  const budget = Math.max(0, stonesLaid + stonesLeft - replenished);
  const brisk = Math.max(0, BRISK_ALLOWANCE - steps * STEP_COST);
  const savedOriginal = Math.max(0, stonesLeft - replenished);
  const spared = savedOriginal * SPARED_STONE_POINTS;

  const lines: ScoreLine[] = [
    {
      detail: "you reached the shrine",
      label: "Arrival",
      points: ARRIVAL_POINTS,
    },
    {
      detail:
        savedOriginal === 1 ? "one original stone saved" : `${savedOriginal} original stones saved`,
      label: "Stones spared",
      points: spared,
    },
    {
      detail: steps === 1 ? "one step" : `${steps} steps`,
      label: "Brevity",
      points: brisk,
    },
  ];

  if (gardenerTurns !== undefined) {
    lines.push({
      label: "Garden rhythm",
      detail: `${gardenerTurns} gardener turns`,
      points: Math.max(0, 240 - gardenerTurns * 40),
    });
  }

  if (catMet) {
    lines.push({
      detail: "the cat came to see who you were",
      label: "Company",
      points: COMPANY_POINTS,
    });
  }

  if (frogFreed) {
    lines.push({
      detail: "you stopped for the frog by the water",
      label: "A courtesy",
      points: COURTESY_POINTS,
    });
  }

  if (catMet && frogFreed) {
    lines.push({
      detail: "neither of them was on your way",
      label: "Good company",
      points: GOOD_COMPANY_POINTS,
    });
  }

  return {
    lines,
    rank: rankFor(stonesLaid, budget, frogFreed, catMet),
    total: lines.reduce((sum, line) => sum + line.points, 0),
  };
};

export type { Score, ScoreLine, Walk };
export { scoreWalk };
