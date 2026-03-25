# Chemistry UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 chemistry UX improvements to the Team page: picker sort toggle, near-threshold hints, coach chemistry preview, and player card link breakdown.

**Architecture:** All changes are incremental additions to existing files. One new pure function in `bonuses.ts`, the rest are UI changes in `Team.tsx`. No new components or pages. Each task is independently shippable.

**Tech Stack:** React 19, TypeScript (strict), Tailwind CSS 4, existing chemistry functions in `src/lib/bonuses.ts` and `src/lib/coachPerks.ts`.

**Spec:** `docs/superpowers/specs/2026-03-25-chemistry-ux-design.md`

**Verification:** No test runner is configured. Verify each task with `npm run build` (TypeScript strict check) and visual inspection in the browser (`npm run dev`).

---

### Task 1: Near-Threshold Hints — Logic (`computeNearThresholdHints`)

**Why first:** This is the only new pure function. Tasks 2-4 are all UI-only and depend on existing logic.

**Files:**
- Modify: `src/lib/bonuses.ts` — add `computeNearThresholdHints` function and export

**Reference:** The existing bonus thresholds are defined inline in `computeActiveBonuses` (lines 24-45 of `bonuses.ts`):
- Club: 2→3%, 3-4→6%, 5+→10%
- Nationality: 2→2%, 3-4→5%, 5+→8%

The `footballerMap` import is already in this file (line 1).

- [ ] **Step 1: Define the hint interface and threshold lookup**

Add after the `totalBonusPercent` function (after line 53) in `src/lib/bonuses.ts`:

```typescript
export interface ThresholdHint {
  label: string        // e.g. "2× England"
  type: 'club' | 'nation'
  potentialPct: number // the bonus at the next tier (e.g. 5 for going from 2→3 nationality)
  currentPct: number   // current bonus for this group (0, 2, 3, 5, 6, 8, 10)
  delta: number        // potentialPct - currentPct
}

function clubTierPct(count: number): number {
  if (count >= 5) return 10
  if (count >= 3) return 6
  if (count >= 2) return 3
  return 0
}

function natTierPct(count: number): number {
  if (count >= 5) return 8
  if (count >= 3) return 5
  if (count >= 2) return 2
  return 0
}
```

- [ ] **Step 2: Implement `computeNearThresholdHints`**

Add below the helpers from step 1:

```typescript
/**
 * Returns up to 4 hints for club/nationality groups that are 1 player away
 * from the next bonus tier, filtered to only groups where the user owns
 * a matching player in their collection.
 */
export function computeNearThresholdHints(
  squad: (string | null)[],
  collection: Record<string, number>
): ThresholdHint[] {
  // If squad bonuses already at cap, no room to improve
  const currentTotal = totalBonusPercent(computeActiveBonuses(squad))
  if (currentTotal >= 40) return []

  const squadPlayers = squad
    .filter((id): id is string => id !== null)
    .map(id => footballerMap.get(id))
    .filter((f): f is Footballer => f !== undefined)

  // Count clubs and nationalities in current squad
  const clubCounts = new Map<string, number>()
  const natCounts = new Map<string, number>()
  for (const p of squadPlayers) {
    clubCounts.set(p.club, (clubCounts.get(p.club) ?? 0) + 1)
    natCounts.set(p.nationality, (natCounts.get(p.nationality) ?? 0) + 1)
  }

  // All owned player objects (not in squad)
  const squadIdSet = new Set(squad.filter((id): id is string => id !== null))
  const ownedBench = Object.keys(collection)
    .filter(id => (collection[id] ?? 0) > 0 && !squadIdSet.has(id))
    .map(id => footballerMap.get(id))
    .filter((f): f is Footballer => f !== undefined)

  // Clubs and nationalities available on the bench
  const benchClubs = new Set(ownedBench.map(f => f.club))
  const benchNats = new Set(ownedBench.map(f => f.nationality))

  const hints: ThresholdHint[] = []

  // Check clubs: current count → count+1, see if it crosses a tier
  for (const [club, count] of clubCounts) {
    const curPct = clubTierPct(count)
    const nextPct = clubTierPct(count + 1)
    if (nextPct > curPct && benchClubs.has(club)) {
      hints.push({ label: `${count}× ${club}`, type: 'club', potentialPct: nextPct, currentPct: curPct, delta: nextPct - curPct })
    }
  }
  // Check nationalities
  for (const [nat, count] of natCounts) {
    const curPct = natTierPct(count)
    const nextPct = natTierPct(count + 1)
    if (nextPct > curPct && benchNats.has(nat)) {
      hints.push({ label: `${count}× ${nat}`, type: 'nation', potentialPct: nextPct, currentPct: curPct, delta: nextPct - curPct })
    }
  }

  // Sort by delta descending, cap at 4
  hints.sort((a, b) => b.delta - a.delta)
  return hints.slice(0, 4)
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bonuses.ts
git commit -m "feat(chemistry): add computeNearThresholdHints function

Computes club/nationality groups 1 player away from next bonus tier,
filtered to groups where user owns a matching player. Capped at 4 hints,
sorted by potential gain. Suppressed when squad chemistry is at 40% cap."
```

---

### Task 2: Near-Threshold Hints — UI

**Files:**
- Modify: `src/pages/Team.tsx` — import new function, add `useMemo` for hints, render below active bonuses panel

**Reference:** The active bonuses panel is at lines 449-461 of `Team.tsx`. The `collection` is already available in the component (line 105). The bonuses panel visibility condition is `activeBonuses.length > 0` (line 449).

- [ ] **Step 1: Add import**

In `src/pages/Team.tsx` line 6, update the import from `bonuses.ts`:

```typescript
import { computeActiveBonuses, totalBonusPercent, computeNearThresholdHints } from '../lib/bonuses'
```

- [ ] **Step 2: Add hints memo**

After the `bonusPct` declaration (line 162), add:

```typescript
  const nearHints = useMemo(
    () => computeNearThresholdHints(viewedTeam.squad, collection),
    [viewedTeam.squad, collection]
  )
```

- [ ] **Step 3: Update bonuses panel visibility and render hints**

Replace the active bonuses panel block (lines 449-461):

```typescript
      {/* Active bonuses + near-threshold hints panel */}
      {(activeBonuses.length > 0 || nearHints.length > 0) && (
        <div className="mb-4 bg-[#0A0F1A] border border-[#FBBF24]/20 rounded-xl px-4 py-3">
          {activeBonuses.length > 0 && (
            <>
              <div className="text-[10px] text-[#5A7090] uppercase tracking-wider mb-2 font-oswald">Активні бонуси</div>
              <div className="flex flex-wrap gap-2">
                {activeBonuses.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-lg px-2 py-1">
                    <span className="text-[10px] text-[#5A7090]">{b.label}</span>
                    <span className="text-[10px] font-oswald font-bold text-[#FBBF24]">+{b.percent}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {nearHints.length > 0 && (
            <>
              {activeBonuses.length > 0 && (
                <div className="border-t border-[#FBBF24]/10 my-2.5" />
              )}
              <div className="text-[10px] text-[#5A7090] uppercase tracking-wider mb-2 font-oswald">Можливі бонуси</div>
              <div className="flex flex-col gap-1.5">
                {nearHints.map((h, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-[#5A7090]">{h.label}</span>
                    <span className="text-[#FBBF24]">→</span>
                    <span className="text-[#5A7090]">ще 1 для <span className="font-oswald font-bold text-[#FBBF24]">+{h.potentialPct}%</span></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Visual verification**

Run: `npm run dev`
Navigate to Team page. With a partially filled squad, confirm:
- Active bonuses still show as before
- Near-threshold hints appear below the divider
- If no active bonuses but hints exist, the panel still shows with just the hints section

- [ ] **Step 6: Commit**

```bash
git add src/pages/Team.tsx
git commit -m "feat(chemistry): show near-threshold bonus hints on Team page

Displays up to 4 hints for club/nationality groups 1 player away from
the next bonus tier. Panel now visible when either active bonuses or
hints exist. Hints show the group name and potential bonus percentage."
```

---

### Task 3: Coach Picker Chemistry Preview

**Files:**
- Modify: `src/pages/Team.tsx` — compute coach chemistry in picker, sort coaches, render chemistry line

**Reference:** The coach picker modal is at lines 810-870 of `Team.tsx`. `computeCoachChemistryPct` is already imported (line 9). `filledPlayers` is already computed (lines 148-153) and contains the squad player objects with `club` property.

- [ ] **Step 1: Replace the coach picker grid with chemistry-sorted coaches**

In the coach picker section (around line 838-866), replace the IIFE that renders coaches. The key changes:
1. Compute chemistry per coach
2. Sort by chemistry descending, then alphabetically
3. Render chemistry line below each coach card

Replace the IIFE block `{(() => { const ownedCoaches = ...` through its closing `})()}` with:

```typescript
              {(() => {
                const ownedCoaches = allCoaches.filter(c => (coachCollection[c.id] ?? 0) > 0)
                if (ownedCoaches.length === 0) {
                  return (
                    <div className="text-center py-8 text-[#5A7090]">
                      <div className="text-4xl mb-3">📋</div>
                      <div className="font-oswald text-sm text-white">Немає тренерів</div>
                      <div className="text-xs mt-1">Купи Тренерський Пакет у магазині</div>
                    </div>
                  )
                }
                // Compute chemistry for each coach against current squad
                const coachesWithChem = ownedCoaches.map(c => {
                  const chemPct = computeCoachChemistryPct(c, filledPlayers)
                  const matchCount = filledPlayers.filter(f => c.clubs.includes(f.club)).length
                  return { coach: c, chemPct, matchCount }
                })
                // Sort: highest chemistry first, then alphabetically by name
                coachesWithChem.sort((a, b) =>
                  b.chemPct - a.chemPct || a.coach.name.localeCompare(b.coach.name)
                )
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {coachesWithChem.map(({ coach: c, chemPct: cPct, matchCount }) => {
                      const lvl = getCoachLevel(c.id, coachCollection)
                      const isActive = assignedCoach === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => { assignCoachAction(viewedTeam.id, c.id); setCoachPickerOpen(false) }}
                          className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isActive ? 'border-[#FBBF24]' : 'border-[#FBBF24]/20 hover:border-[#FBBF24]/50'}`}
                        >
                          <CoachCard coach={c} level={lvl} mini={false} showPerk />
                          {cPct > 0 && (
                            <div className="px-3 pb-2 -mt-1 text-[10px] font-oswald font-bold text-[#FBBF24]">
                              ⚡ {matchCount} гравців → +{cPct}% хімія
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Visual verification**

Run: `npm run dev`
Navigate to Team page, open coach picker:
- Each owned coach shows chemistry line (e.g., "⚡ 7 гравців → +35% хімія") if they have matches
- Coaches with higher chemistry appear first
- Coaches with 0 matches show no chemistry line
- Currently assigned coach still has gold border

- [ ] **Step 4: Commit**

```bash
git add src/pages/Team.tsx
git commit -m "feat(chemistry): show chemistry preview in coach picker

Each coach card now displays how many squad players match their clubs
and the resulting chemistry percentage. Coaches sorted by chemistry
descending to surface the most relevant options first."
```

---

### Task 4: Player Picker Sort Toggle

**Files:**
- Modify: `src/pages/Team.tsx` — add sort state, toggle UI in picker header, sort logic

**Reference:** The picker header is at lines 696-708. The `pickerPlayers` memo is at lines 196-201. The chemistry delta is computed per player in the render loop at lines 721-726.

- [ ] **Step 1: Add sort state**

After the `panelMode` state declaration (line 138), add:

```typescript
  const [pickerSort, setPickerSort] = useState<'rating' | 'chemistry'>('rating')
```

- [ ] **Step 2: Reset sort when picker closes**

In the `closePanel` function (find it near the state declarations), add `setPickerSort('rating')` to the body. If `closePanel` is defined as:

```typescript
  function closePanel() {
    setActiveSlot(null)
    setPanelMode('idle')
  }
```

Update to:

```typescript
  function closePanel() {
    setActiveSlot(null)
    setPanelMode('idle')
    setPickerSort('rating')
  }
```

- [ ] **Step 3: Pre-compute totalDelta for sorting**

Replace the `pickerPlayers` memo (lines 196-201) with a version that includes pre-computed delta:

```typescript
  const pickerPlayers = useMemo(() => {
    if (!activeSlotDef) return [] as (Footballer & { _totalDelta: number })[]
    return footballers
      .filter(f => f.position === activeSlotDef.pos && ownedIds.has(f.id))
      .map(f => {
        const inSquad = squad.includes(f.id)
        const chemDelta = !inSquad && activeSlot !== null
          ? computeChemistryDelta(squad, activeSlot, f.id)
          : 0
        const hasCoachChem = !inSquad && assignedCoachObj !== null && assignedCoachObj.clubs.includes(f.club)
        const coachChemDelta = hasCoachChem ? 5 : 0
        return { ...f, _totalDelta: chemDelta + coachChemDelta } as Footballer & { _totalDelta: number }
      })
      .sort((a, b) => playerOverall(b) - playerOverall(a))
  }, [activeSlotDef, ownedIds, squad, activeSlot, assignedCoachObj])

  const sortedPickerPlayers = useMemo(() => {
    if (pickerSort === 'rating') return pickerPlayers
    return [...pickerPlayers].sort((a, b) => {
      const deltaSort = b._totalDelta - a._totalDelta
      if (deltaSort !== 0) return deltaSort
      return playerOverall(b) - playerOverall(a)
    })
  }, [pickerPlayers, pickerSort])
```

Note: `activeSlotDef` depends on `activeSlot` (line 194: `const activeSlotDef = activeSlot !== null ? SLOTS[activeSlot] : null`), so the dependency array must include `activeSlot` separately since `activeSlotDef` is derived.

- [ ] **Step 4: Add sort toggle UI in picker header**

Replace the picker header (lines 696-708) with:

```typescript
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs text-[#5A7090] uppercase tracking-wider">Вибери гравця</div>
                        <div className="font-oswald text-lg font-bold text-white">
                          {POS_UA[SLOTS[activeSlot].pos]}
                          <span className="text-[#5A7090] font-normal text-base ml-2">— позиція {activeSlot + 1}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPickerSort('rating')}
                          className={`text-[9px] font-oswald font-bold uppercase px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                            pickerSort === 'rating'
                              ? 'bg-[#00E676]/20 text-[#00E676]'
                              : 'text-[#5A7090] hover:text-white'
                          }`}
                        >⭐ Рейтинг</button>
                        <button
                          onClick={() => setPickerSort('chemistry')}
                          className={`text-[9px] font-oswald font-bold uppercase px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                            pickerSort === 'chemistry'
                              ? 'bg-[#FBBF24]/20 text-[#FBBF24]'
                              : 'text-[#5A7090] hover:text-white'
                          }`}
                        >🔗 Хімія</button>
                        <button
                          onClick={closePanel}
                          className="w-8 h-8 flex items-center justify-center text-[#5A7090] hover:text-white hover:bg-[#1A2336] rounded-lg transition-colors text-xl cursor-pointer"
                        >×</button>
                      </div>
                    </div>
```

- [ ] **Step 5: Update the picker grid to use `sortedPickerPlayers` and pre-computed delta**

In the picker grid (lines 717-763), change `pickerPlayers.map(f => {` to `sortedPickerPlayers.map(f => {`.

Also simplify the render since delta is pre-computed. Replace the per-player delta computation block (lines 719-726) — the `inSquad`, `chemDelta`, `hasCoachChem`, `coachChemDelta`, `totalDelta` variables — with:

```typescript
                        {sortedPickerPlayers.map(f => {
                          const inSquad = squad.includes(f.id)
                          const overall = playerOverall(f)
                          const totalDelta = f._totalDelta
                          const hasCoachChem = !inSquad && assignedCoachObj !== null && assignedCoachObj.clubs.includes(f.club)
```

The rest of the card rendering stays the same (it uses `totalDelta` and `hasCoachChem` which are still defined).

Also update the empty state check: change `pickerPlayers.length === 0` to `sortedPickerPlayers.length === 0`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 7: Visual verification**

Run: `npm run dev`
- Open player picker for any slot
- Default sort is "Рейтинг" (green active pill)
- Click "Хімія" pill — players with highest chemistry delta appear first
- Players with 0 delta sink to bottom, still sorted by rating among themselves
- Close and reopen picker — resets to rating sort

- [ ] **Step 8: Commit**

```bash
git add src/pages/Team.tsx
git commit -m "feat(chemistry): add sort toggle in player picker (rating/chemistry)

Player picker now has a rating/chemistry toggle. Chemistry sort orders
players by combined squad+coach chemistry delta descending, with rating
as tiebreaker. Resets to rating sort when picker closes."
```

---

### Task 5: Player Card Chemistry Breakdown

**Files:**
- Modify: `src/pages/Team.tsx` — add `computeChemistryBreakdown` function, update player card rendering in picker

**Reference:** Current player card in picker is at lines 728-761. The card already shows: photo, name, club, nationality, overall rating, plus the `+X%` badge and 🎯 icon.

- [ ] **Step 1: Add `computeChemistryBreakdown` helper function**

Add this function above the `Team` component (e.g., after `computeChemistryDelta` around line 95):

```typescript
interface ChemBreakdownTag {
  label: string       // e.g. "Inter 3" or "🎯"
  pct: number         // e.g. 6 or 5
  type: 'club' | 'nation' | 'coach'
}

function computeChemistryBreakdown(
  currentSquad: (string | null)[],
  slotIndex: number,
  candidateId: string,
  assignedCoach: { clubs: string[] } | null
): ChemBreakdownTag[] {
  const candidate = footballerMap.get(candidateId)
  if (!candidate) return []

  // Null out the target slot to exclude the player being replaced
  const squadWithoutSlot = [...currentSquad]
  squadWithoutSlot[slotIndex] = null

  const squadPlayers = squadWithoutSlot
    .filter((id): id is string => id !== null)
    .map(id => footballerMap.get(id))
    .filter((f): f is Footballer => f !== undefined)

  const tags: ChemBreakdownTag[] = []

  // Club delta
  const clubCount = squadPlayers.filter(f => f.club === candidate.club).length
  const clubCurPct = clubCount >= 5 ? 10 : clubCount >= 3 ? 6 : clubCount >= 2 ? 3 : 0
  const clubNewCount = clubCount + 1
  const clubNewPct = clubNewCount >= 5 ? 10 : clubNewCount >= 3 ? 6 : clubNewCount >= 2 ? 3 : 0
  if (clubNewPct > clubCurPct) {
    tags.push({ label: `${candidate.club} ${clubNewCount}`, pct: clubNewPct - clubCurPct, type: 'club' })
  }

  // Nationality delta
  const natCount = squadPlayers.filter(f => f.nationality === candidate.nationality).length
  const natCurPct = natCount >= 5 ? 8 : natCount >= 3 ? 5 : natCount >= 2 ? 2 : 0
  const natNewCount = natCount + 1
  const natNewPct = natNewCount >= 5 ? 8 : natNewCount >= 3 ? 5 : natNewCount >= 2 ? 2 : 0
  if (natNewPct > natCurPct) {
    tags.push({ label: `${candidate.nationality} ${natNewCount}`, pct: natNewPct - natCurPct, type: 'nation' })
  }

  // Coach delta
  if (assignedCoach && assignedCoach.clubs.includes(candidate.club)) {
    tags.push({ label: '🎯', pct: 5, type: 'coach' })
  }

  return tags
}
```

- [ ] **Step 2: Update pre-computed picker data to include breakdown**

In the `pickerPlayers` memo (from Task 4), extend the mapped object to also store the breakdown. Add after `_totalDelta`:

```typescript
        _breakdown: inSquad || activeSlot === null ? [] : computeChemistryBreakdown(squad, activeSlot, f.id, assignedCoachObj)
```

Update the type annotation from `Footballer & { _totalDelta: number }` to `Footballer & { _totalDelta: number; _breakdown: ChemBreakdownTag[] }` in both the empty return and the memo.

- [ ] **Step 3: Replace the `+X%` badge and 🎯 icon with breakdown tags**

In the player card rendering inside `sortedPickerPlayers.map(...)`, replace the badge and coach icon elements:

Remove the existing badge (`totalDelta > 0 && (...)` block with the `-top-1.5 -right-1.5` badge) and the existing 🎯 icon (`hasCoachChem && (...)` block).

After the overall rating line (`<div className="text-[10px] font-oswald font-bold text-[#00E676]">{overall}</div>`), add the breakdown:

```typescript
                              {f._breakdown.length > 0 && (
                                <div className="w-full flex flex-col items-start gap-0.5 mt-0.5">
                                  {f._breakdown.map((tag, ti) => (
                                    <div
                                      key={ti}
                                      className={`text-[9px] font-oswald font-bold leading-none ${
                                        tag.type === 'club' ? 'text-[#00E676]'
                                          : tag.type === 'nation' ? 'text-[#FBBF24]'
                                          : 'text-[#FBBF24]'
                                      }`}
                                    >
                                      {tag.label}→+{tag.pct}%
                                    </div>
                                  ))}
                                  <div className={`text-[9px] font-oswald font-bold self-end leading-none ${
                                    totalDelta > 0 ? 'text-white' : 'text-[#5A7090]'
                                  }`}>
                                    +{totalDelta}%
                                  </div>
                                </div>
                              )}
```

- [ ] **Step 4: Update card border styling**

The card border styling currently depends on `totalDelta > 0` and `hasCoachChem`. Update to also consider breakdown presence for the cap edge case (breakdown exists but totalDelta is 0):

```typescript
                              className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-left ${
                                inSquad
                                  ? 'border-[#1A2336] opacity-35 cursor-not-allowed'
                                  : totalDelta > 0
                                    ? 'border-[#FBBF24]/40 bg-[#FBBF24]/5 hover:border-[#FBBF24]/70 hover:bg-[#FBBF24]/10 cursor-pointer active:scale-95'
                                    : f._breakdown.length > 0
                                      ? 'border-[#5A7090]/30 bg-[#5A7090]/5 hover:border-[#5A7090]/50 cursor-pointer active:scale-95'
                                      : 'border-[#1A2336] hover:border-[#00E676]/60 hover:bg-[#00E676]/5 cursor-pointer active:scale-95'
                              }`}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Visual verification**

Run: `npm run dev`
- Open player picker for a slot
- Players that boost chemistry show breakdown tags at the bottom:
  - Club links in green (e.g., "Inter 3→+6%")
  - Nationality links in amber (e.g., "Italy 3→+5%")
  - Coach link as "🎯→+5%"
  - Total in white at bottom-right (e.g., "+16%")
- Players at the cap show breakdown but "+0%" in muted gray
- Players with no chemistry show no tags (clean card like before)

- [ ] **Step 7: Commit**

```bash
git add src/pages/Team.tsx
git commit -m "feat(chemistry): show link breakdown on player cards in picker

Player cards in the picker now show exactly which club, nationality, and
coach links contribute to chemistry. Breakdown replaces the old +X% badge
with individual tagged lines. Handles 40% cap edge case with muted total."
```

---

### Task 6: Final Verification & Cleanup

**Files:**
- Verify: `src/pages/Team.tsx`, `src/lib/bonuses.ts`

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Clean build with zero warnings.

- [ ] **Step 2: End-to-end visual walkthrough**

Run: `npm run dev` and verify all 4 features together:
1. Near-threshold hints appear in bonuses panel
2. Coach picker shows chemistry per coach, sorted by chemistry
3. Player picker has rating/chemistry sort toggle
4. Player cards show chemistry breakdown tags
5. All text is in Ukrainian
6. Mobile responsive (check at 375px width)

- [ ] **Step 3: Commit if any cleanup was needed**

Only if fixes were made in this task.
