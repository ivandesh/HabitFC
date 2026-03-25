# Chemistry UX Improvements — Design Spec

## Problem

Users cannot effectively optimize squad chemistry without external help. The UI shows chemistry *after* picks are made but doesn't help *plan* picks. Key blind spots:

- Player picker sorted only by rating — chemistry-boosting players are scattered
- No visibility into near-threshold bonuses (e.g., "1 more Italian for +5%")
- Coach picker shows zero chemistry info before assignment
- Chemistry badge (`+X%`) gives no breakdown of where the bonus comes from

## Scope

Four incremental enhancements to existing Team.tsx components. No new pages, no new modals, no auto-build features. Approach A: integrated into existing UI patterns.

---

## Feature 1: Sort Player Picker by Chemistry

### Current State
Player picker grid sorted by overall rating (highest first). Yellow border + `+X%` badge on chemistry-boosting players, but they're scattered throughout the list.

### Design
A small toggle in the picker header, right-aligned next to the position label:

```
ЗАХ (4 available)          [⭐ Рейтинг] [🔗 Хімія]
```

- Two pill-style buttons, same style as existing formation selector pills
- Default: **Рейтинг** (Rating) — current behavior
- **Хімія** (Chemistry) — sorts by `totalDelta` descending (highest chemistry gain first), then by rating as tiebreaker
- Players with `totalDelta === 0` appear at the bottom, still sorted by rating
- The yellow highlight + `+X%` badge stays as-is regardless of sort mode
- Sort preference resets when picker closes (no persistence needed)

### Files Affected
- `src/pages/Team.tsx` — add sort state, toggle UI, sort logic in picker section

---

## Feature 2: Near-Threshold Hints in Bonuses Panel

### Current State
The "Активні бонуси" panel shows only bonuses that are already active. No indication of what's close to unlocking.

### Design
A new subsection below the existing active bonuses, separated by a subtle divider. Only appears when there are near-miss opportunities.

```
Активні бонуси
  4× Tottenham          +6%
  3× Inter Milan        +6%
  3× Italy              +5%

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

Можливі бонуси
  2× England    → ще 1 для +5%
  1× Germany    → ще 1 для +2%
```

### Rules
- **Club:** Show hints for groups 1 player away from the next bonus tier (1→2 for +3%, 2→3 for +6%, 4→5 for +10%)
- **Nationality:** Same logic (1→2 for +2%, 2→3 for +5%, 4→5 for +8%)
- Only show hints where the user **owns** a player in their collection that could fill the gap (actionable hints only)
- Cap at ~4 hints max, prioritized by potential % gain descending
- Style: muted text (`text-[#5A7090]`), smaller font than active bonuses, arrow (→) in `text-[#FBBF24]`

### Files Affected
- `src/lib/bonuses.ts` — new `computeNearThresholdHints(squad, collection)` function
- `src/pages/Team.tsx` — render hints below active bonuses panel

---

## Feature 3: Coach Picker Chemistry Preview

### Current State
Coach picker modal shows coach name, emoji, perk description, level stars. No chemistry information until after assignment. This was the biggest blind spot — e.g., Conte giving 35% vs Klopp giving 20% was invisible before committing.

### Design
Add a chemistry line to each coach card in the picker, below the perk description:

```
Antonio Conte 😠
Streak ≥3: +8 монет
★☆☆
⚡ 7 гравців → +35% хімія
```

- Format: `⚡ {count} гравців → +{pct}% хімія`
- Calculated against the **current squad** (filled slots only)
- If 0 matches: don't show the line
- Coaches sorted by chemistry % descending, then alphabetically as tiebreaker
- Currently assigned coach keeps its existing highlight border
- Color: `text-[#FBBF24]` for the chemistry line (gold coach theme)

### Files Affected
- `src/pages/Team.tsx` — compute coach chemistry per owned coach in picker, add to coach card rendering, sort coaches

---

## Feature 4: Player Card Link Explanation in Picker

### Current State
Players that boost chemistry get a yellow border + `+X%` badge in the top-right corner. No explanation of why.

### Design
Replace the single `+X%` badge with a breakdown area at the bottom of the player card in the picker:

```
┌─────────────┐
│   [Photo]    │
│  Darmian     │
│  Inter Milan │
│  Italy       │
│  OVR 65      │
│              │
│ Inter 3→+6%  │
│ Italy 3→+5%  │
│ 🎯 +5%       │
│        +16%  │
└─────────────┘
```

- Each tag is a tiny pill: `{group} {count}→+{pct}%`
  - Club links: green text (`text-[#00E676]`)
  - Nationality links: amber text (`text-[#FBBF24]`)
  - Coach link: 🎯 with `+5%`
- Count shows what the total would be *after* adding this player (e.g., "Inter 3" = this would be the 3rd Inter player)
- Total delta `+X%` in bottom-right, bolder — replaces the current top-right badge
- Only show tags for links that actually contribute (skip zero-delta)
- If no chemistry contribution: no tags, no badge (current behavior preserved)
- Tags use `text-[8px]` to fit within existing card width

### Computation
For each candidate player, compute:
1. Club delta: count of same-club players already in squad + 1 → look up new tier bonus − current tier bonus
2. Nationality delta: same logic for nationality
3. Coach delta: +5% if player's club is in assigned coach's clubs and player isn't already in squad
4. Sum = total delta. Break down into individual tags.

### Files Affected
- `src/pages/Team.tsx` — new `computeChemistryBreakdown()` function, updated player card rendering in picker

---

## Non-Goals

- Auto-build / optimize chemistry button (removes fun from the game)
- Coach chemistry lines on pitch (current 🎯 emoji is sufficient)
- Cross-position player suggestions (picker stays filtered by slot position)
- Persisting sort preference across sessions

## Technical Notes

- All chemistry computations already exist (`computeActiveBonuses`, `totalBonusPercent`, `computeCoachChemistryPct`, `computeChemistryDelta`). New logic builds on top of these.
- Feature 2 requires a new function in `bonuses.ts` that takes both squad and collection to check what's achievable.
- Features 1, 3, 4 are purely UI changes in Team.tsx using existing computation functions.
- All text in Ukrainian, consistent with existing UI language.
