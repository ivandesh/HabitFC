# Daily Football Trivia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily football trivia quiz that awards 50 coins for correct answers, shown once per day on app open.

**Architecture:** Client-side question bank in a data file. Zustand store tracks last answer date and question history. A modal component renders in Dashboard on first visit of the day.

**Tech Stack:** React, TypeScript, Zustand, Framer Motion, Tailwind CSS

---

### Task 1: Create trivia questions data file

**Files:**
- Create: `src/data/triviaQuestions.ts`

- [ ] **Step 1: Create the TriviaQuestion interface and question array**

Create `src/data/triviaQuestions.ts` with the `TriviaQuestion` interface and ~75 football trivia questions in Ukrainian. Each question has `id`, `question`, `options` (4-tuple), `correctIndex` (0-3), and optional `funFact`.

```typescript
export interface TriviaQuestion {
  id: number
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  funFact?: string
}

export const triviaQuestions: TriviaQuestion[] = [
  {
    id: 1,
    question: 'Хто забив "Руку Бога" на ЧС 1986?',
    options: ['Пеле', 'Дієго Марадона', 'Зінедін Зідан', 'Йоган Кройфф'],
    correctIndex: 1,
    funFact: 'Марадона забив цей гол рукою у чвертьфіналі проти Англії',
  },
  // ... ~74 more questions covering:
  // - Iconic World Cup moments
  // - Champions League records
  // - Transfer fees and records
  // - Player stats and milestones
  // - Ukrainian football (Dynamo Kyiv, Shakhtar, national team)
  // - Meme-worthy football moments
  // - Club history trivia
]
```

Questions should mix difficulty levels — some easy (who won WC 2022), some tricky (specific stats/years). All text in Ukrainian.

- [ ] **Step 2: Commit**

```bash
git add src/data/triviaQuestions.ts
git commit -m "feat: add football trivia questions data file (~75 questions)"
```

---

### Task 2: Add trivia state to Zustand store and AppState type

**Files:**
- Modify: `src/types.ts:34-49` (AppState interface)
- Modify: `src/store/useAppStore.ts:11-38` (AppStore interface + initial state + actions + importState + resetAll)

- [ ] **Step 1: Add trivia fields to AppState in types.ts**

In `src/types.ts`, add to the `AppState` interface (after `following`):

```typescript
  lastTriviaDate: string | null       // YYYY-MM-DD of last answered trivia
  triviaHistory: number[]             // IDs of previously answered questions
```

- [ ] **Step 2: Add answerTrivia action to AppStore interface**

In `src/store/useAppStore.ts`, add to the `AppStore` interface:

```typescript
  answerTrivia: (questionId: number, correct: boolean) => void
```

- [ ] **Step 3: Add initial state values**

In the `create<AppStore>()` call, add after `following: []`:

```typescript
  lastTriviaDate: null,
  triviaHistory: [],
```

- [ ] **Step 4: Implement answerTrivia action**

Add before `addCoins`:

```typescript
  answerTrivia: (questionId, correct) => {
    set(state => ({
      lastTriviaDate: getToday(),
      triviaHistory: [...state.triviaHistory, questionId],
      coins: correct ? state.coins + 50 : state.coins,
    }))
  },
```

- [ ] **Step 5: Update importState to include new fields**

In the `importState` method, add:

```typescript
  lastTriviaDate: data.lastTriviaDate ?? null,
  triviaHistory: data.triviaHistory ?? [],
```

- [ ] **Step 6: Update resetAll to include new fields**

In the `resetAll` method, add:

```typescript
  lastTriviaDate: null,
  triviaHistory: [],
```

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/store/useAppStore.ts
git commit -m "feat: add trivia state tracking to Zustand store"
```

---

### Task 3: Create TriviaModal component

**Files:**
- Create: `src/components/ui/TriviaModal.tsx`

- [ ] **Step 1: Build the TriviaModal component**

Create `src/components/ui/TriviaModal.tsx`. Follow the existing modal pattern from `ProfileModal.tsx`:

```typescript
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { triviaQuestions, type TriviaQuestion } from '../../data/triviaQuestions'
import { getToday } from '../../lib/streaks'

interface Props {
  onClose: () => void
}

function pickQuestion(history: number[]): TriviaQuestion {
  const available = triviaQuestions.filter(q => !history.includes(q.id))
  const pool = available.length > 0 ? available : triviaQuestions
  return pool[Math.floor(Math.random() * pool.length)]
}

export function TriviaModal({ onClose }: Props) {
  const { answerTrivia, triviaHistory } = useAppStore()
  const [question] = useState(() => pickQuestion(triviaHistory))
  const [selected, setSelected] = useState<number | null>(null)
  const isAnswered = selected !== null
  const isCorrect = selected === question.correctIndex

  function handleSelect(index: number) {
    if (isAnswered) return
    setSelected(index)
    answerTrivia(question.id, index === question.correctIndex)
  }

  // ... render modal with:
  // - Header: "⚽ Вікторина дня"
  // - Question text
  // - 4 option buttons (motion.button with staggered entrance)
  // - After answer: green/red highlight, result text, fun fact, close button
  // - Escape key and backdrop click only work after answering
}
```

**Styling details:**
- Modal container: `fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4`
- Card: `bg-[#04060A] border border-[#1A2336] rounded-2xl p-6 w-full max-w-sm space-y-5`
- Header: `font-oswald text-lg tracking-wide text-white uppercase`
- Question: `text-[#E8F0FF] text-sm leading-relaxed`
- Options: `w-full p-3 rounded-xl border text-left text-sm transition-all`
  - Default: `border-[#1A2336] bg-[#0A0F1A] text-[#E8F0FF] hover:border-[#00E676]/50`
  - Correct (after answer): `border-[#00E676] bg-[#00E676]/10 text-[#00E676]`
  - Wrong (selected): `border-red-500 bg-red-500/10 text-red-400`
- Result correct: `text-[#00E676] font-oswald` showing "+50 монет!"
- Result wrong: `text-red-400` showing "Краще пощастить завтра!"
- Fun fact: `text-[#5A7090] text-xs italic`
- Close button: `w-full py-3 rounded-xl bg-[#00E676] text-black font-oswald font-bold uppercase tracking-wider`

**Framer Motion:**
- Options: `initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}` with staggered `transition={{ delay: i * 0.1 }}`
- Result text: `initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}`

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/TriviaModal.tsx
git commit -m "feat: add TriviaModal component with answer flow and animations"
```

---

### Task 4: Wire TriviaModal into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx:1-10` (imports and hook logic)

- [ ] **Step 1: Add trivia state and modal rendering to Dashboard**

In `src/pages/Dashboard.tsx`:

1. Add imports:
```typescript
import { useState, useEffect } from 'react'
import { TriviaModal } from '../components/ui/TriviaModal'
import { getToday } from '../lib/streaks'
```

2. Inside the `Dashboard` component, add before the return:
```typescript
const lastTriviaDate = useAppStore(state => state.lastTriviaDate)
const [showTrivia, setShowTrivia] = useState(false)

useEffect(() => {
  if (lastTriviaDate !== getToday()) {
    setShowTrivia(true)
  }
}, [])
```

3. Add before the closing `</div>` of the root element:
```tsx
{showTrivia && <TriviaModal onClose={() => setShowTrivia(false)} />}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: show daily trivia modal on Dashboard when not answered today"
```

---

### Task 5: Manual testing and polish

- [ ] **Step 1: Run dev server and verify**

```bash
npm run dev
```

Test:
1. Open app → trivia modal appears
2. Select wrong answer → red highlight, correct shown green, "Краще пощастить завтра!"
3. Close modal → refresh page → modal does NOT appear again
4. Check coin balance after correct answer → +50

- [ ] **Step 2: Verify state persistence**

1. Answer trivia → refresh → modal should not reappear
2. Check that `lastTriviaDate` and `triviaHistory` survive page reload (Supabase sync)

- [ ] **Step 3: Final commit if any polish needed**

```bash
git add -A
git commit -m "fix: polish daily trivia feature"
```
