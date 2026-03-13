# Mobile Card UI — Responsive Scaling

**Date:** 2026-03-11
**Status:** Approved

## Problem

On mobile screens (~375px), footballer cards in the pack opening reveal row display poorly: stats are cropped and text is too large. The root cause is that `FootballerCard` uses fixed desktop-sized values (`p-4`, `w-20 h-20`, `text-lg`, etc.) that don't scale down for the card's actual rendered size on mobile (~157×243px).

## Scope

- File: `src/components/cards/FootballerCard.tsx`
- Mode: full card only (`mini` prop path is untouched)
- Applies everywhere the component is used (pack opening + collection)
- Layout: horizontal scroll row on pack opening stays as-is

## Solution

Add responsive Tailwind `sm:` breakpoints (640px) to size-sensitive classes. No API changes, no new props.

## Changes

| Element | Current | Mobile `<640px` |
|---|---|---|
| Outer padding | `p-4` | `p-2` |
| Inner gap | `gap-2` | `gap-1` |
| Photo | `w-20 h-20` | `w-14 h-14` |
| Emoji fallback | `text-6xl` | `text-4xl` |
| Name | `text-lg` | `text-sm` |
| Club | `text-sm` | `text-xs` |
| Nationality | `text-xs` | `text-[10px]` |
| Stat row padding | `px-2 py-1` | `px-1 py-0.5` |

Rarity label (`text-xs`) unchanged — already fits.

## Non-goals

- No changes to card dimensions (`CARD_W`/`CARD_H` clamp values)
- No changes to `mini` card mode
- No changes to layout (horizontal scroll stays)
- No changes to `CoachCard` or other components
