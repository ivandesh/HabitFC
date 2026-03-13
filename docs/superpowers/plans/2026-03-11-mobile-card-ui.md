# Mobile Card UI — Responsive Scaling Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `FootballerCard` (full mode) render correctly on mobile by replacing fixed desktop-sized Tailwind classes with responsive `sm:` variants.

**Architecture:** Single file edit to `FootballerCard.tsx` — add `sm:` prefixed classes alongside existing ones so values shrink on screens narrower than 640px. No API changes, no new props, no layout changes.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Chunk 1: Update FootballerCard responsive classes

**Files:**
- Modify: `src/components/cards/FootballerCard.tsx`

> Note: This is a pure styling change. There are no unit-testable logic paths. Verification is visual — check the card looks correct on a ~375px viewport using browser DevTools.

- [ ] **Step 1: Open the file and locate the full card render path**

Open `src/components/cards/FootballerCard.tsx`. The full card `return` starts at line 43. The `mini` block above it (lines 19–41) must NOT be touched.

- [ ] **Step 2: Update outer container padding and gap**

Find the outer `div` on line 44:
```tsx
<div className={`border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} rounded-2xl p-4 flex flex-col items-center gap-2 w-full h-full`}>
```
Change `p-4` → `p-2 sm:p-4` and `gap-2` → `gap-1 sm:gap-2`:
```tsx
<div className={`border-2 ${cfg.border} ${cfg.bg} ${cfg.glow} rounded-2xl p-2 sm:p-4 flex flex-col items-center gap-1 sm:gap-2 w-full h-full`}>
```

- [ ] **Step 3: Update photo size**

Find the `<img>` on line 48:
```tsx
className="w-20 h-20 object-contain rounded-full bg-black/30"
```
Change to:
```tsx
className="w-14 h-14 sm:w-20 sm:h-20 object-contain rounded-full bg-black/30"
```

- [ ] **Step 4: Update emoji fallback size**

Find the emoji `<div>` on line 54:
```tsx
<div className="text-6xl">{footballer.emoji}</div>
```
Change to:
```tsx
<div className="text-4xl sm:text-6xl">{footballer.emoji}</div>
```

- [ ] **Step 5: Update name, club, nationality text sizes**

Find the text block starting at line 56:
```tsx
<div className="text-center">
  <div className="font-bold text-lg leading-tight">{footballer.name}</div>
  <div className="text-sm text-gray-400">{footballer.club}</div>
  <div className="text-xs text-gray-500">{footballer.nationality}</div>
</div>
```
Change to:
```tsx
<div className="text-center">
  <div className="font-bold text-sm sm:text-lg leading-tight">{footballer.name}</div>
  <div className="text-xs sm:text-sm text-gray-400">{footballer.club}</div>
  <div className="text-[10px] sm:text-xs text-gray-500">{footballer.nationality}</div>
</div>
```

- [ ] **Step 6: Update stats grid row padding**

Find the stats grid on line 61. All four stat rows use `px-2 py-1`:
```tsx
<div className="w-full grid grid-cols-2 gap-1 text-xs">
  <div className="flex justify-between bg-gray-900/50 rounded px-2 py-1">
  ...
```
Change every `px-2 py-1` (4 occurrences) to `px-1 py-0.5 sm:px-2 sm:py-1`:
```tsx
<div className="w-full grid grid-cols-2 gap-1 text-xs">
  <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
    <span className="text-gray-500">PAC</span>
    <span className="font-bold">{footballer.stats.pace}</span>
  </div>
  <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
    <span className="text-gray-500">SHO</span>
    <span className="font-bold">{footballer.stats.shooting}</span>
  </div>
  <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
    <span className="text-gray-500">PAS</span>
    <span className="font-bold">{footballer.stats.passing}</span>
  </div>
  <div className="flex justify-between bg-gray-900/50 rounded px-1 py-0.5 sm:px-2 sm:py-1">
    <span className="text-gray-500">DRI</span>
    <span className="font-bold">{footballer.stats.dribbling}</span>
  </div>
</div>
```

- [ ] **Step 7: Verify visually in browser DevTools**

Run the dev server:
```bash
npm run dev
```
Open browser → navigate to Shop → open any pack.
In DevTools, toggle device emulation to iPhone SE (375×667). Confirm:
- All stats are visible (not cropped)
- Name fits on one or two lines without overflow
- Photo/emoji is proportional to card size
- Card looks clean at 375px and also correct at 768px+

- [ ] **Step 8: Commit**

```bash
git add src/components/cards/FootballerCard.tsx
git commit -m "fix: make FootballerCard responsive for mobile viewports"
```
