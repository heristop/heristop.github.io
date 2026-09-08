# Garden engine complexity audit

September 2026. Let V be board tiles, E neighbouring edges (at most 4V), W water tiles,
L lights, D displayed objects, C gardener candidates, G remaining goals, and K rake actions.
The current board has 144 tiles and at most five collectible goals.

| Operation | Before | After |
| --- | --- | --- |
| Cheapest route | O(V² log V) upper bound from sorting the frontier on every extraction | O((V + E) log V), stable binary heap, stop when destination is settled |
| Cheapest crossing | O(V²) from array front insertions/removals | O(V + E), indexed deque and settled set |
| Walkable/reachability/carving BFS | O(V²) from array shifts | O(V + E), advancing array head |
| Route reconstruction | O(V²) from repeated prepends | O(V), append then reverse |
| Water light neighbourhoods | O(WL) | O(L + W), index the 13 cells within Manhattan radius two |
| Asset discovery for an already loaded map | O(V) per scene update | O(1) weak identity lookup; discovery remains O(V) for a new map |

Map asset identities are recorded only after successful loading. Concurrent updates still use
revision checks; obsolete scenes cannot replace the newest scene. The weak cache does not
retain historical maps. This relies on the existing immutable game map contract.

Equal-price routes still prefer fewer steps. Equal ranks retain insertion order, preserving
N/E/S/W direction tie-breaking. A separate relaxation oracle checks costs and lengths on
32 deterministic gardens with obstacles and different budgets. Water tests cover both sides
of the radius boundary, including diagonal distance.

## Remaining costs

Animation callbacks are linear in animated objects. The four actors are a fixed population.
Pixi depth ordering can sort dirty children in O(D log D); no quadratic per-frame search was
found in the audited renderer. This is CPU complexity, not a GPU fill-rate or frame-time measurement.

Gardener candidate scoring is still O(K C G (V + E)), plus sorting candidates and validating
feasibility. It intentionally simulates each candidate terrain change to preserve tactical
behaviour. It runs during turn planning, not on each animation frame.

`tourCompletes` explores goal permutations: factorial in G in the worst case, with route searches
and terrain copies along each branch. G is capped at five (120 complete permutations). The
routing improvements also accelerate these searches. Increasing the goal count substantially
would require redesigning this validator. Memoizing by position and remaining goals alone is
incorrect because different branches have different paved terrain and remaining stones.

No FPS gain is claimed from these asymptotic improvements. The small current board limits
absolute gains; native GPU benchmarking remains necessary for rendering performance claims.
