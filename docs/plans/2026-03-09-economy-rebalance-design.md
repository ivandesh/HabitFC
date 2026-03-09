# Economy Rebalance Design

**Date:** 2026-03-09
**Status:** Approved

## Context

The existing pack economy felt too cheap (players could open packs constantly with no scarcity), legendary/epic rates were too high given the small card pool, and there was no pity mechanic. Duplicate refunds were negligible relative to pack cost.

## Goals

- Packs feel like a meaningful daily goal, not trivial impulse buys
- Pulling a legendary feels like an event
- Soft pity rewards persistence without guaranteeing legendaries
- Duplicates refund enough to feel like consolation progress

## Income Baseline

A typical dedicated player with 5 habits @ 50 coins, 7-day streak, light squad bonus earns ~400 coins/day. Pack costs are designed relative to this.

---

## Pack Costs & Rarity Weights

All packs give **3 cards**.

| Pack | Cost | Common | Rare | Epic | Legendary |
|------|------|--------|------|------|-----------|
| Basic (Базовий) | 200 | 70% | 22% | 7% | 1% |
| Premium (Преміум) | 400 | 50% | 33% | 14% | 3% |
| Elite (Еліт) | 750 | 0% | 45% | 45% | 10% |

- Basic ≈ half a day's grind; lottery feel, mostly commons
- Premium ≈ 1 day's work; real shot at epic
- Elite ≈ ~2 days; no commons, 1-in-10 legendary chance

Legendary rates drop from old 2/5/15% → new 1/3/10% since the card pool is small.

---

## Soft Pity Mechanic

A `pityCounters` object is stored in app state, keyed by pack id (`basic`, `premium`, `elite`). It tracks consecutive packs opened with no legendary pulled, resetting to 0 when a legendary drops.

**Formula applied inside `pickRarity` (or `openPack`):**
```
effectiveLegendaryWeight = baseWeight + max(0, pityCounter - 10) × 2
cap at 50
```

- Pity activates after **10 packs** without legendary
- Each additional pack adds **+2%** to legendary weight
- Hard cap at **50%** (very likely, never guaranteed)
- Counters are independent per pack type

Example (Elite, 10% base): pack 10 → 10%, pack 11 → 12%, pack 15 → 20%, pack 30 → 50%.

---

## Duplicate Refunds

| Rarity | Old | New |
|--------|-----|-----|
| Common | 5 | 10 |
| Rare | 15 | 30 |
| Epic | 40 | 80 |
| Legendary | 100 | 200 |

A legendary duplicate (200 coins) is still painful but represents meaningful progress toward another Elite pack (750 coins).

---

## Implementation Scope

Files to change:

1. **`src/data/packs.ts`** — update cost, cardCount (3 for all), weights
2. **`src/lib/gacha.ts`** — update `duplicateRefund`, add soft pity logic to `openPack` (accepts pityCounter, returns updated counter)
3. **`src/store/useAppStore.ts`** — add `pityCounters` to state, pass/update in `buyPack`
4. **`src/types.ts`** — no changes needed (Pack type already covers this)

No UI changes required — the pack card display reads from `packs.ts` dynamically.
