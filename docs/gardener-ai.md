# Gardener decisions and offline tuning

The gardener evaluates complete rake plans while keeping the nearest reachable stone's
approach as a mandatory target. Once the stones are collected, it uses the shrine.
The last rake ends its turn. The terrain, player tile, discoveries, supply rules and
attack behavior retain their existing protections.

Numeric weights remain unchanged and the promotion checks have not been relaxed.
Earlier reports below predate the simulated players' frog-rescue correction; use the
[corrected comparison](gardener-first-comparison-2026-09-10.md) for current results.

## Decisions during play

1. Rank goals by actual walking distance, then by the player's paving cost.
2. Find the closest legal, reachable and affordable rake on the economical approach.
   If the final approach is already sand, work back along that route.
3. Keep that rake mandatory and compare up to 29 plans, using up to seven optional
   candidates on the current route or the alternative opened by the mandatory rake.
4. Score added paving cost, useful work, walking distance, bends, spatial grouping,
   and repeated interventions. Small seeded variation only breaks near ties.
5. Visit candidates in score order. Simplify each to a subset if that keeps the same
   paving pressure with fewer steps, no more bends and no more repetition. Work along
   the way remains eligible; removing a detour does not promote another aggressive plan.
6. Test the simplified candidate with the existing remaining-tour affordability
   search. Return only a verified plan; at most three rakes are allowed.

The pathfinder minimizes steps first, then bends over the entire ordered turn. It keeps
the best shortest approach for each possible arrival heading and chooses the combination
that avoids unnecessary reversals at later rakes. Distance fields and approach results
are shared across candidate plans; the search retains at most four headings per state.
Equal whole-turn costs prefer the locally smooth approach, then the established
direction order, so anticipation only changes the route when it saves bends.
Memory carries the heading between turns and records completed rakes, never intentions.
It retains the last two turns, is bounded to nine positions, and clears on restart.
A mandatory approach can be raked again if the player has repaved it; memory only
discourages optional repetition.

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
A player unable to take its chosen step first tries an affordable approach to the
unrescued frog. It follows that detour until the real reducer grants the bonus, then
resumes its original policy. An unavailable detour still counts as a blocked strategy;
reaching the 800-action simulation limit is a separate failure.

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

These historical measurements use the simulator before its frog-rescue correction.

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

A later [comparison](gardener-first-comparison-2026-09-10.md) includes the original
policy, the first new planner with manual weights, and that same planner after training.
Its initial claim of a robustness regression was a simulator error: players ignored an
affordable frog rescue. The linked report now uses the corrected players for every policy.

## Extended training on 10 September 2026

A second run started from the shipped profile with seed 20260910, 24 individuals,
32 generations and 24 training gardens: 694 distinct profiles and 49,968 simulated
games. Validation used 96 gardens and 288 games per policy. The command, starting
weights, candidate weights, snapshot hash and generation history are archived in the
[training report](gardener-training-2026-09-10.json).

| Metric | Shipped profile | New candidate |
| --- | ---: | ---: |
| Training fitness | 90.5461 | 91.4570 |
| Validation fitness | 90.1892 | 90.0948 |
| Validation lookahead wins | 96 / 96 | 96 / 96 |
| Validation economical wins | 95 / 96 | 95 / 96 |
| Validation nearest-goal wins | 68 / 96 | 71 / 96 |
| Mean gardener steps per validation game | 16.976 | 16.851 |
| Mean turn cost per validation game | 5.198 | 5.014 |
| Mean rounds in validation wins | 3.707 | 3.698 |

The candidate improved movement slightly, but its higher nearest-goal win rate moved
further from the difficulty target. Overall validation fitness fell, so the existing
promotion rule rejected it. The shipped profile remains the result of the first run.
The candidate was not evaluated on the reserved final audit set after that rejection.
No rule or threshold was relaxed to promote this result.

## Whole-turn planning experiment on 10 September 2026

Planning now carries alternative arrival headings through the complete ordered turn.
An independent exhaustive search checks shortest distance and minimum total bend cost
across three rakes, obstacles and incoming headings. Equal costs retain the established
direction choices. A separate regression covers a two-rake route that formerly reversed
after the first rake despite an equally short route with fewer bends.

The selected plan also loses optional detours when a shorter subset creates the same
paving pressure without more bends or repetition. Simplification preserves the selected
constraint: deleting that plan from the ranking instead could promote a longer and more
aggressive alternative. Both cases have regression tests.

Comparison used 352 gardens and 1,056 complete games per policy, with the same numeric
weights, snapshot and generated boards for each pair. The first 224 gardens informed
development and all pass the existing promotion checks. The last 128 gardens were
reserved until the implementation was fixed; their result was not used for another
tuning iteration. The [planning report](gardener-planning-2026-09-10.json) records all
four sets, exact variant ranges, code and snapshot hashes, and decision timings.

| Final audit metric | Previous planner | New planner |
| --- | ---: | ---: |
| Lookahead wins | 127 / 128 | 127 / 128 |
| Economical wins | 121 / 128 | 121 / 128 |
| Nearest-goal wins | 93 / 128 | 94 / 128 |
| Mean rounds in winning games | 3.710 | 3.711 |
| Mean gardener steps per game | 17.953 | 17.914 |
| Mean turn cost per game | 5.542 | 5.549 |
| Boards with no tested winning strategy | 1 | 1 |
| First-round wins or simulation loops | 0 | 0 |

This historical audit refused promotion. All three players reported losses on
`audit/quiet/61` with both versions. That apparent robustness regression was later traced
to the players ignoring the frog bonus, not to an impossible garden. The new version
also lost 0.0600 fitness on that set, mostly
because another nearest-goal win moves further from the difficulty target. Across all
sets, walking falls by about 0.2%, average bend cost is unchanged, and winning games
still average 3.71 rounds. These are targeted planning corrections, not evidence of a
broad difficulty or naturalness improvement. The numeric profile stays unchanged.

## Frog-rescue correction

On `audit/quiet/61`, the economical and lookahead bots reached `(9, 3)` with four stones
collected and no paving supply. The last stone at `(9, 2)` cost one, so the bots stopped.
The game remained in the player phase because the frog at `(11, 9)` was still reachable.
A 13-step free walk to `(10, 9)` rescues it and grants two stones. Replaying that detour,
collecting the last stone and returning to the shrine completes the unchanged game in
73 steps and three refills.

The simulator now considers this legal detour before declaring a strategy blocked,
retains the rescue destination between steps, and obtains all rewards through the
production reducer. Both strategies have end-to-end regression tests. No garden tile,
gardener decision, reward amount or difficulty threshold was changed for this fix.
The corrected comparison reruns all policies with the same updated players.

## Verification

```sh
pnpm test:garden:coverage
pnpm exec vitest run tests/scripts/gardener-evolution.test.ts
pnpm build
```

The suite covers protected terrain, the mandatory approach, memory/reset, shortest walks,
heading continuity, whole-turn optimality against an independent exhaustive search,
optional detours, deterministic genetic improvement, parameter bounds and independent
scenario sets. Whole-game tests check actual rake actions independently of the planner.
Naturalness is assessed through movement and repetition metrics; player testing is still
needed to judge whether those choices feel believable.
