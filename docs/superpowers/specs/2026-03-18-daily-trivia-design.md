# Daily Football Trivia Feature

## Overview
A daily football trivia question that appears when the user opens the app. Correct answer awards 50 coins. One attempt per day — after answering, it won't appear again until the next day.

## Data Layer

**New file: `src/data/triviaQuestions.ts`**

```typescript
export interface TriviaQuestion {
  id: number
  question: string        // Ukrainian language
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  funFact?: string        // Optional fun fact shown after answering
}

export const triviaQuestions: TriviaQuestion[] = [
  // ~75 questions covering:
  // - Iconic moments (World Cup finals, Champions League drama)
  // - Transfer trivia (record fees, surprising moves)
  // - Player records and stats
  // - Club history and culture
  // - Meme-worthy football moments
  // - Ukrainian football knowledge
]
```

Questions are hardcoded client-side, matching the pattern of `src/data/footballers.ts`.

## State Changes

**In `src/store/useAppStore.ts`:**

Add to state:
- `lastTriviaDate: string | null` — `YYYY-MM-DD` of last answered trivia (null = never answered)
- `triviaHistory: number[]` — IDs of previously answered questions (to avoid repeats)

Add action:
- `answerTrivia(questionId: number, correct: boolean)` — sets `lastTriviaDate` to today, pushes questionId to `triviaHistory`, calls `addCoins(50)` if correct

No Supabase schema changes needed — these fields persist automatically via the existing `stateSync.ts` full-state sync.

## Component

**New file: `src/components/ui/TriviaModal.tsx`**

Follows the existing modal pattern:
- Fixed backdrop (`fixed inset-0 bg-black/70 z-50`)
- Escape key to close (only after answering)
- `onClick` backdrop close (only after answering)
- Cannot dismiss before answering

### UI Flow

1. **Question state:** Header "Вікторина дня" + question text + 4 option buttons stacked vertically
2. **User taps an option:**
   - Correct answer highlights green (`#00E676`)
   - Wrong answer highlights red, correct answer also highlights green
   - Show fun fact if available
   - If correct: "+50" coin animation, celebratory text
   - If wrong: "Краще пощастить завтра!" encouragement text
3. **Result state:** Shows result + "Закрити" button to dismiss

### Styling
- Dark card background (`#04060A` with `#1A2336` border) — matches existing modals
- `font-oswald` for header
- Football emoji in header
- Framer Motion: option buttons animate in, result reveal animates

## Trigger Logic

**In `src/pages/Dashboard.tsx`:**

```typescript
const { lastTriviaDate } = useAppStore()
const [showTrivia, setShowTrivia] = useState(false)

useEffect(() => {
  const today = getToday() // from streaks.ts
  if (lastTriviaDate !== today) {
    setShowTrivia(true)
  }
}, [])
```

### Question Selection
- Filter `triviaQuestions` to exclude IDs in `triviaHistory`
- Pick random from remaining
- If all exhausted, reset `triviaHistory` to empty and pick from full pool

## Reward
- 50 coins for correct answer
- 0 coins for wrong answer
- One attempt per day (no retries)

## Edge Cases
- All questions exhausted: reset history, cycle through again
- User navigates away from Dashboard and back: modal won't re-show if already answered today
- State loads async: trivia check runs after state is imported (existing AuthGuard handles this)
