# Gardener decisions and offline tuning

The gardener evaluates complete rake plans while keeping the nearest reachable stone's
approach as a mandatory target. Once the stones are collected, it uses the shrine.
The last rake ends its turn. The terrain, player tile, discoveries, supply rules and
attack behavior retain their existing protections.

## Decisions during play

1. Rank goals by actual walking distance, then by the player's paving cost.
2. Find the closest legal, reachable and affordable rake on the economical approach.
   If the final approach is already sand, work back along that route.
3. Keep that rake mandatory and compare up to 29 plans, using up to seven optional
   candidates on the current route or the alternative opened by the mandatory rake.
4. Score added paving cost, useful work, walking distance, bends, spatial grouping,
   and repeated interventions. Small seeded variation only breaks near ties.
5. Test candidates in score order with the existing remaining-tour affordability
   search. Return only a verified plan; at most three rakes are allowed.

The pathfinder minimizes steps first and bends second, carrying the previous heading
between walks. Memory records completed rakes, never intentions. It retains the last
two turns, is bounded to nine positions, and clears on restart. A mandatory approach
can be raked again if the player has repaved it; memory only discourages optional
repetition.

The affordability search proves a route under its existing paving model. It is not a
proof that every player strategy wins or that every possible future encounter is safe.
The production reducer remains the authority for movement, refill timing and attacks.

## Offline genetic algorithm

Node 22.18+ is required. No extra runtime dependency, network service or training code
is shipped to the browser. The browser loads only the selected numeric profile.

```sh
pnpm tune:garden --population=12 --generations=8 --training-variants=2 --validation-variants=4 --seed=731 --output=/tmp/gardener-ai.json
pnpm tune:garden --population=12 --generations=8 --training-variants=2 --validation-variants=4 --seed=731 --apply --output=/tmp/gardener-ai.json
pnpm evaluate:garden --validation-variants=12 --output=/tmp/gardener-ai-evaluation.json
pnpm evaluate:garden --audit --validation-variants=8 --output=/tmp/gardener-ai-audit.json
```

Training uses full games played through the production reducer against economical,
nearest-goal and lookahead player strategies. The published garden is excluded from
training and included in validation. Synthetic histories cover inactivity, sparse work,
steady activity, bursts and extreme counts. Training and validation use different seeds.

The seven genes weight pressure, amount of work, walking, bends, repetition, grouping
and slight variation. Selection uses three-way tournaments, crossover chooses genes
from either parent, bounded mutation explores new settings, and two elites survive each
generation. Duplicate genomes reuse their deterministic fitness.
Each run starts from the committed profile. Reproduction requires the same starting
profile, GitHub snapshot, seeds and code; the report records the starting weights.

Fitness targets a band of difficulty and three-to-four-round games while penalizing
unnecessary walking, bends and repeated rakes. Wins alone are not the objective.
A player policy unable to continue its chosen route counts as a loss; reaching the
800-action simulation limit is a separate failure.

`--apply` writes `src/components/client/garden/board/gardener-profile.json` only after
held-out checks pass: every board has a tested winning strategy, no one-round victories,
no simulation loops, no excessive difficulty increase, and no movement or quality
regression against the starting profile. It returns a failing exit status when promotion
is refused. Review the report and run the tests before committing a new profile.

The frozen policy in `scripts/garden-ai/legacy.ts` is the baseline from commit `9240751`.
It is imported only by offline tooling. Reports include its results, the starting
utility profile, the evolved profile, all game outcomes and decision-time percentiles.
Timing depends on the machine and is not part of genetic fitness.
Evaluation compares the current profile with that frozen baseline. `--audit` uses a
third seed set excluded from both training and validation and cannot be used for training.
Offline scripts enter the game through `headless.ts`; the website stays on `index.ts`.

Best-score keys include the policy version and profile hash so changing the opponent
does not compare new runs against scores earned with different settings. The GitHub
terrain seed is unchanged.

## Shipped profile results

The initial training run used seed 731, a population of 12 and eight generations:
81 distinct profiles evaluated on 12 training boards, followed by 32 validation boards.
Each board is played by all three strategies. Promotion passed on the validation set.
The starting weights were pressure 4, work 1, walking 0.16, bends 0.35, repetition 2,
variation 0.08 and cohesion 0.12. The selected weights are committed in the profile JSON.

A separate audit then played 192 games on 64 fresh boards:

| Metric | Previous gardener | Evolved gardener |
| --- | ---: | ---: |
| Lookahead wins | 64 / 64 | 64 / 64 |
| Economical wins | 60 / 64 | 60 / 64 |
| Nearest-goal wins | 39 / 64 | 40 / 64 |
| Mean rounds in winning games | 3.80 | 3.84 |
| Mean gardener steps per game | 21.76 | 17.46 |
| Mean turn cost (quarter-turn equivalents) | 10.00 | 5.37 |
| First-round wins | 0 | 0 |
| Boards with no tested winning strategy | 0 | 0 |

Walking falls by about 20% and turn cost by 46%, with similar sampled difficulty.
Neither version reached the simulation action limit. A strategy can still lose or get
stuck pursuing an unaffordable target; these are counted as losses, not omitted.

## Verification

```sh
pnpm test:garden:coverage
pnpm exec vitest run tests/scripts/gardener-evolution.test.ts
pnpm build
```

The suite covers protected terrain, the mandatory approach, memory/reset, shortest walks,
heading continuity, deterministic genetic improvement, parameter bounds and independent
scenario sets. Whole-game tests check actual rake actions independently of the planner.
Naturalness is assessed through movement and repetition metrics; player testing is still
needed to judge whether those choices feel believable.
