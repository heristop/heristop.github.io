# Gardener comparison with corrected players

Updated on 10 September 2026 after fixing frog-rescue behavior in the offline players. **416 gardens, 1,248 games per policy, 4,992 games total.** The earlier 352 gardens were rerun and 64 additional gardens were checked. All versions use identical boards and the same corrected players.

## Correction to the earlier conclusion

The earlier report incorrectly described `audit/quiet/61` as a robustness regression in the garden. The economical and lookahead bots stopped at `(9, 3)` with four stones collected and no supply. They ignored a free path to the frog, which grants two paving stones through the existing game rules.

Replaying the actual game reducer confirms a winning continuation: 13 free steps to `(10, 9)` rescue the frog at `(11, 9)`, 14 steps and one paving stone reach the last stone at `(9, 2)`, then 14 free steps reach the shrine at `(3, 6)`. The full game takes 73 steps and three refills. Both bots now complete this route; the nearest-goal bot still loses through different earlier choices.

The simulator now tries an affordable frog approach before declaring a strategy blocked. It keeps that rescue destination between moves and resumes its normal policy after the actual reducer grants the reward. Two end-to-end tests reproduced the original failure and pass with the fix. No game rule, garden tile, gardener policy, numeric weight or promotion threshold was changed.

## Results

Original is `9240751`. Manual and trained use the first planner from `49d01a6`, with its starting weights and first trained weights respectively. Current uses the later whole-turn planner from `6d2e5d0`. Holding the planner constant between manual and trained isolates genetic tuning relative to those starting weights.

| Metric | Original | Manual new planner | First trained | Current planner |
| --- | ---: | ---: | ---: | ---: |
| Gardener steps / game | 21.98 | 20.01 | 17.47 | 17.44 |
| Turn cost / game | 10.51 | 7.01 | 5.39 | 5.39 |
| Rakes / game | 6.03 | 6.30 | 5.25 | 5.23 |
| Rounds / winning game | 3.71 | 3.78 | 3.73 | 3.73 |
| Lookahead wins | 416 / 416 | 416 / 416 | 416 / 416 | 416 / 416 |
| Economical wins | 407 / 416 | 405 / 416 | 409 / 416 | 409 / 416 |
| Nearest-goal wins | 326 / 416 | 331 / 416 | 336 / 416 | 337 / 416 |
| Gardens with at least one tested winner | 416 / 416 | 416 / 416 | 416 / 416 | 416 / 416 |
| First-round wins / simulation loops | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

Turn cost counts quarter-turn equivalents: a reversal costs two. Movement averages include losses. Duration is averaged only over winning games. A strategy can still make losing choices; having one tested winner does not mean all routes or every possible garden are safe.

The first trained planner uses **20.51% fewer gardener steps** and **48.73% less turn cost** than the original. Against the same planner with manual weights, the genetic tuning contributes **12.69% fewer steps** and **23.11% less turn cost**. These observations support a movement improvement, not a claim that genetic search is the best tuning method or that human enjoyment has been measured.

The first trained version passes the aggregate promotion checks against the original and manual versions. The current whole-turn planner passes the solvability and simulation checks but remains slightly below the first trained profile on aggregate fitness (89.1575 versus 89.1656). One extra nearest-goal win moves farther from the difficulty target. Its only aggregate promotion failure is the quality score; the earlier claim of a blocked garden is withdrawn.

## Reproducibility

The [machine-readable report](gardener-first-comparison-2026-09-10.json) records all five scenario configurations, commits, snapshot/simulator/board hashes, both weight profiles, per-set and aggregate results, paired outcome changes, gate results and the winning rescue proof. Generate the full variant count before filtering the inclusive range, because variant count also determines frog placement. The extra audit uses variants 64–71 from `scenarios("audit", 72)`.

The frozen original policy was checked against its git source. Both first-planner variants use the exported `49d01a6` implementation. Every evaluation checks that its initial layouts remain unchanged, and summaries are recomputed from the individual outcomes. No new training was performed. Older saved training and planning reports used the incomplete players and remain historical records; their failed rescue case must not be treated as an impossible garden.
