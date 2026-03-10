# Backend Migration (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Zustand localStorage persistence with Supabase backend, adding email/password accounts and cross-device sync.

**Architecture:** All game logic stays client-side in Zustand. Supabase stores one JSONB blob per user. A sync layer subscribes to Zustand changes and debounce-writes to Supabase. Auth is handled by Supabase Auth with a dedicated auth store.

**Tech Stack:** React + TypeScript + Vite, Zustand 5, @supabase/supabase-js, React Router 7, Tailwind CSS, Framer Motion

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/supabase.ts` | Supabase client singleton |
| Create | `src/lib/stateSync.ts` | Load/save state blob, debounce, flush on unload |
| Create | `src/store/useAuthStore.ts` | Auth state: user, loading, signIn, signUp, signOut |
| Create | `src/pages/LoginPage.tsx` | Login + register form with migration prompt |
| Create | `src/components/AuthGuard.tsx` | Redirect to /login if no session |
| Modify | `src/store/useAppStore.ts` | Remove `persist`, add store subscription for sync |
| Modify | `src/App.tsx` | Add /login route, loading screen, logout button in NavBar |
| Create | `.env` | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (local dev) |

---

## Chunk 1: Supabase project setup + client

### Task 1: Create Supabase project and database table

This is done in the Supabase dashboard — no code yet.

- [ ] **Step 1: Create a Supabase project**

  Go to https://supabase.com → New project. Choose a name (e.g. `habitfc`), pick a region close to you, set a database password. Wait for it to provision (~1 minute).

- [ ] **Step 2: Run SQL to create the user_state table**

  In Supabase dashboard → SQL Editor → New query. Paste and run:

  ```sql
  create table user_state (
    user_id    uuid references auth.users(id) on delete cascade primary key,
    state      jsonb not null default '{}',
    updated_at timestamptz default now()
  );

  alter table user_state enable row level security;

  create policy "own state only"
    on user_state for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  ```

  Expected: "Success. No rows returned."

- [ ] **Step 3: Disable email confirmation (for simplicity)**

  In Supabase dashboard → Authentication → Providers → Email → turn OFF "Confirm email". Save.

- [ ] **Step 4: Copy your project credentials**

  In Supabase dashboard → Project Settings → API. Copy:
  - **Project URL** (looks like `https://xxxx.supabase.co`)
  - **anon public** key (long JWT string)

---

### Task 2: Install SDK and create Supabase client

- [ ] **Step 1: Install the Supabase JS SDK**

  Run: `npm install @supabase/supabase-js`

  Expected: package added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Create `.env` file**

  Create `.env` in the project root (next to `package.json`):

  ```env
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-key-here
  ```

  Replace with the values from Task 1 Step 4.

- [ ] **Step 3: Add `.env` to `.gitignore`**

  Open `.gitignore` and verify `.env` is listed (Vite projects usually include it). If not, add it:

  ```
  .env
  ```

- [ ] **Step 4: Create `src/lib/supabase.ts`**

  ```typescript
  import { createClient } from '@supabase/supabase-js'

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  export const supabase = createClient(supabaseUrl, supabaseAnonKey)
  ```

- [ ] **Step 5: Verify it compiles**

  Run: `npm run build`

  Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/supabase.ts .gitignore
  git commit -m "feat: add Supabase client"
  ```

  Note: do NOT commit `.env`.

---

## Chunk 2: Auth store + state sync

### Task 3: Create auth store

- [ ] **Step 1: Create `src/store/useAuthStore.ts`**

  ```typescript
  import { create } from 'zustand'
  import type { User } from '@supabase/supabase-js'
  import { supabase } from '../lib/supabase'

  interface AuthStore {
    user: User | null
    loading: boolean
    setUser: (user: User | null) => void
    setLoading: (loading: boolean) => void
    signIn: (email: string, password: string) => Promise<string | null>
    signUp: (email: string, password: string) => Promise<string | null>
    signOut: () => Promise<void>
  }

  export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    loading: true,

    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ loading }),

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error?.message ?? null
    },

    signUp: async (email, password) => {
      const { error } = await supabase.auth.signUp({ email, password })
      return error?.message ?? null
    },

    signOut: async () => {
      await supabase.auth.signOut()
      set({ user: null })
    },
  }))
  ```

- [ ] **Step 2: Verify it compiles**

  Run: `npm run build`

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/store/useAuthStore.ts
  git commit -m "feat: add auth store"
  ```

---

### Task 4: Create state sync layer

- [ ] **Step 1: Create `src/lib/stateSync.ts`**

  ```typescript
  import { supabase } from './supabase'
  import type { AppState } from '../types'

  const EXCLUDED_KEYS: (keyof AppState)[] = ['pendingUnlocks']

  function serializeState(state: AppState): Record<string, unknown> {
    const result: Record<string, unknown> = { ...state }
    for (const key of EXCLUDED_KEYS) {
      delete result[key]
    }
    return result
  }

  export async function loadState(userId: string): Promise<Partial<AppState> | null> {
    const { data, error } = await supabase
      .from('user_state')
      .select('state')
      .eq('user_id', userId)
      .single()

    if (error || !data) return null
    return data.state as Partial<AppState>
  }

  export async function saveState(userId: string, state: AppState): Promise<void> {
    await supabase
      .from('user_state')
      .upsert({ user_id: userId, state: serializeState(state), updated_at: new Date().toISOString() })
  }

  // Debounced save: 1.5s after last call
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let pendingSave: (() => Promise<void>) | null = null

  export function scheduleSave(userId: string, state: AppState): void {
    pendingSave = () => saveState(userId, state)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      pendingSave?.()
      pendingSave = null
      debounceTimer = null
    }, 1500)
  }

  export function flushSave(): void {
    if (pendingSave) {
      if (debounceTimer) clearTimeout(debounceTimer)
      pendingSave()
      pendingSave = null
      debounceTimer = null
    }
  }
  ```

- [ ] **Step 2: Verify it compiles**

  Run: `npm run build`

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/stateSync.ts
  git commit -m "feat: add state sync layer (load/save/debounce)"
  ```

---

### Task 5: Modify useAppStore — remove persist, add sync subscription

- [ ] **Step 1: Open `src/store/useAppStore.ts`**

  Read the file carefully — you need to make two changes:
  1. Remove the `persist` wrapper entirely (keep all the inner logic)
  2. Export a `syncSubscribe` function that wires up the store subscription

- [ ] **Step 2: Remove `persist` middleware**

  Replace the outer `create<AppStore>()(persist(..., {...}))` structure with just `create<AppStore>()((set, get) => ({ ... }))`.

  Before:
  ```typescript
  export const useAppStore = create<AppStore>()(
    persist(
      (set, get) => ({
        // ...all store logic...
      }),
      {
        name: 'habit-tracker-store',
        partialize: (state) => {
          const { pendingUnlocks, ...rest } = state
          return rest
        },
      }
    )
  )
  ```

  After:
  ```typescript
  export const useAppStore = create<AppStore>()((set, get) => ({
    // ...all store logic — exactly the same, untouched...
  }))
  ```

  Also remove the `persist` import from the top of the file:
  ```typescript
  // Remove this line:
  import { persist } from 'zustand/middleware'
  ```

- [ ] **Step 3: Add `syncSubscribe` export to `src/store/useAppStore.ts`**

  At the **top** of the file, add this import alongside the existing imports:

  ```typescript
  import { scheduleSave, flushSave } from '../lib/stateSync'
  ```

  Then at the **bottom** of the file, after the `useAppStore` declaration, add:

  ```typescript
  // Call this once after the user logs in, passing their userId.
  // Returns an unsubscribe function.
  export function syncSubscribe(userId: string): () => void {
    const unsubscribe = useAppStore.subscribe((state) => {
      scheduleSave(userId, state)
    })

    // Note: flushSave fires synchronously but the underlying saveState is async.
    // Browsers do not wait for Promises in beforeunload, so this is best-effort.
    window.addEventListener('beforeunload', flushSave)

    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', flushSave)
    }
  }
  ```

- [ ] **Step 4: Verify it compiles**

  Run: `npm run build`

  Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/store/useAppStore.ts
  git commit -m "feat: remove persist middleware, add syncSubscribe"
  ```

---

## Chunk 3: Auth UI

### Task 6: Create LoginPage

- [ ] **Step 1: Create `src/pages/LoginPage.tsx`**

  ```tsx
  import { useState } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { supabase } from '../lib/supabase'
  import { useAuthStore } from '../store/useAuthStore'
  import { useAppStore } from '../store/useAppStore'
  import { saveState } from '../lib/stateSync'

  const LOCAL_STORAGE_KEY = 'habit-tracker-store'

  function readLocalState() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      // Zustand persist wraps state in { state: {...}, version: N }
      return parsed?.state ?? null
    } catch {
      return null
    }
  }

  export function LoginPage() {
    const [tab, setTab] = useState<'login' | 'register'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [showMigration, setShowMigration] = useState(false)
    const [pendingUserId, setPendingUserId] = useState<string | null>(null)

    const { signIn, signUp } = useAuthStore()
    const importState = useAppStore(s => s.importState)
    const navigate = useNavigate()

    async function handleLogin(e: React.FormEvent) {
      e.preventDefault()
      setError(null)
      setLoading(true)
      const err = await signIn(email, password)
      setLoading(false)
      if (err) { setError(err); return }
      navigate('/')
    }

    async function handleRegister(e: React.FormEvent) {
      e.preventDefault()
      setError(null)
      if (password !== confirm) { setError('Паролі не збігаються'); return }
      setLoading(true)
      const err = await signUp(email, password)
      setLoading(false)
      if (err) { setError(err); return }

      // Get the newly created user id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/'); return }

      const localState = readLocalState()
      if (localState) {
        setPendingUserId(user.id)
        setShowMigration(true)
      } else {
        navigate('/')
      }
    }

    async function handleMigrate(yes: boolean) {
      if (yes && pendingUserId) {
        const localState = readLocalState()
        if (localState) {
          importState(localState)
          await saveState(pendingUserId, useAppStore.getState())
        }
      }
      localStorage.removeItem(LOCAL_STORAGE_KEY)
      setShowMigration(false)
      navigate('/')
    }

    if (showMigration) {
      return (
        <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center p-4">
          <div className="bg-[#0D1526] border border-[#1A2336] rounded-2xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">💾</div>
            <h2 className="font-oswald text-xl text-[#E8F0FF] mb-3">Знайдено дані на пристрої</h2>
            <p className="text-[#5A7090] text-sm mb-6">Перенести існуючий прогрес (звички, монети, картки) в акаунт?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleMigrate(false)}
                className="flex-1 py-3 rounded-xl border border-[#1A2336] text-[#5A7090] font-oswald tracking-wider hover:border-[#5A7090] transition-colors cursor-pointer"
              >
                Ні
              </button>
              <button
                onClick={() => handleMigrate(true)}
                className="flex-1 py-3 rounded-xl bg-[#00E676] text-[#0A0F1A] font-oswald tracking-wider font-bold hover:bg-[#00FF84] transition-colors cursor-pointer"
              >
                Перенести
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center p-4">
        <div className="bg-[#0D1526] border border-[#1A2336] rounded-2xl p-8 max-w-sm w-full">
          <div className="text-center mb-8">
            <span className="font-oswald text-3xl font-bold tracking-wider">
              <span className="text-[#00E676]">⚽</span>{' '}
              <span className="text-white">HABIT<span className="text-[#00E676]">FC</span></span>
            </span>
          </div>

          {/* Tabs */}
          <div className="flex mb-6 bg-[#0A0F1A] rounded-xl p-1">
            {(['login', 'register'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null) }}
                className={`flex-1 py-2 rounded-lg font-oswald text-sm tracking-wider uppercase transition-colors cursor-pointer ${
                  tab === t ? 'bg-[#1A2336] text-[#E8F0FF]' : 'text-[#5A7090] hover:text-[#E8F0FF]'
                }`}
              >
                {t === 'login' ? 'Увійти' : 'Реєстрація'}
              </button>
            ))}
          </div>

          <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl text-[#E8F0FF] placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl text-[#E8F0FF] placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
            />
            {tab === 'register' && (
              <input
                type="password"
                placeholder="Підтвердіть пароль"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl text-[#E8F0FF] placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
              />
            )}

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00E676] text-[#0A0F1A] font-oswald font-bold tracking-wider rounded-xl hover:bg-[#00FF84] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? '...' : tab === 'login' ? 'Увійти' : 'Зареєструватись'}
            </button>
          </form>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify it compiles**

  Run: `npm run build`

  Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/LoginPage.tsx
  git commit -m "feat: add login/register page with migration prompt"
  ```

---

### Task 7: Create AuthGuard

- [ ] **Step 1: Create `src/components/AuthGuard.tsx`**

  ```tsx
  import { useEffect } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { supabase } from '../lib/supabase'
  import { useAuthStore } from '../store/useAuthStore'
  import { useAppStore, syncSubscribe } from '../store/useAppStore'
  import { loadState } from '../lib/stateSync'

  let unsubscribeSync: (() => void) | null = null

  export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, setUser, setLoading } = useAuthStore()
    const importState = useAppStore(s => s.importState)
    const navigate = useNavigate()

    useEffect(() => {
      // Check initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        const u = session?.user ?? null
        setUser(u)
        setLoading(false)

        if (u) {
          // Load state from Supabase
          loadState(u.id).then(state => {
            if (state) importState(state)
            // Start sync subscription
            unsubscribeSync?.()
            unsubscribeSync = syncSubscribe(u.id)
          })
        }
      })

      // Listen for auth changes (login/logout)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const u = session?.user ?? null
        setUser(u)

        if (!u) {
          unsubscribeSync?.()
          unsubscribeSync = null
          navigate('/login')
        }
      })

      return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
      if (!loading && !user) {
        navigate('/login')
      }
    }, [loading, user])

    if (loading) {
      return (
        <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center">
          <span className="font-oswald text-2xl text-[#00E676] tracking-widest animate-pulse">HABITFC</span>
        </div>
      )
    }

    if (!user) return null

    return <>{children}</>
  }
  ```

- [ ] **Step 2: Verify it compiles**

  Run: `npm run build`

  Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/AuthGuard.tsx
  git commit -m "feat: add AuthGuard with session check and state loading"
  ```

---

## Chunk 4: Wire everything together

### Task 8: Update App.tsx — add /login route, AuthGuard, logout button

- [ ] **Step 1: Add /login route and AuthGuard to `src/App.tsx`**

  Add these imports at the top:
  ```typescript
  import { LoginPage } from './pages/LoginPage'
  import { AuthGuard } from './components/AuthGuard'
  import { useAuthStore } from './store/useAuthStore'
  ```

  Wrap the main content with `<AuthGuard>` and add the login route. Update the `App` function.

  **Note:** `NavBar`, `AchievementToastManager`, and `BottomNav` are intentionally placed inside `<AuthGuard>`. They should only render when authenticated — this also ensures the logout button in `NavBar` is always accessible after login.

  ```tsx
  export default function App() {
    return (
      <BrowserRouter basename="/HabitFC">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={
            <AuthGuard>
              <div className="min-h-screen bg-[#04060A] stadium-lines">
                <AchievementToastManager />
                <NavBar />
                <div className="pb-14 sm:pb-0">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/open" element={<PackOpening />} />
                    <Route path="/collection" element={<Collection />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/achievements" element={<Achievements />} />
                  </Routes>
                </div>
                <BottomNav />
              </div>
            </AuthGuard>
          } />
        </Routes>
      </BrowserRouter>
    )
  }
  ```

- [ ] **Step 2: Add logout button to NavBar in `src/App.tsx`**

  In `NavBar`, add the auth store and a logout button next to the existing action buttons. Add this import inside the `NavBar` function:

  ```typescript
  const { signOut } = useAuthStore()
  ```

  Add a logout button in both the mobile top bar and the desktop nav (alongside the existing ⬇️ ⬆️ 🔄 buttons):

  ```tsx
  <button
    onClick={() => signOut()}
    className="p-2 text-[#5A7090] hover:text-red-400 transition-colors cursor-pointer"
    title="Вийти з акаунту"
  >
    🚪
  </button>
  ```

- [ ] **Step 3: Verify it compiles and runs**

  Run: `npm run dev`

  Expected:
  - App opens in browser
  - Redirects to `/login` page
  - Login and Register tabs are visible

- [ ] **Step 4: Test the full flow manually** *(human-only step — requires a browser)*

  1. Register a new account with your email
  2. If you had existing localStorage data, confirm the migration prompt appears
  3. Click "Перенести" — verify your habits/coins/cards are visible in the app
  4. Open the app in another browser/incognito — log in — verify same data appears
  5. Complete a habit — wait 2 seconds — refresh the other browser — data should be updated
  6. Click logout (🚪) — verify redirected to login page

  If cross-device sync is not working: check Supabase dashboard → Table Editor → `user_state` to confirm the row was upserted. If the row is missing, check browser devtools console for Supabase errors (likely a missing env var or RLS misconfiguration).

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: wire AuthGuard, login route, and logout button into App"
  ```

---

## Chunk 5: GitHub Pages deployment

### Task 9: Add Supabase env vars to GitHub Actions

The app is deployed to GitHub Pages via GitHub Actions. The Supabase keys need to be injected at build time.

- [ ] **Step 1: Add secrets to GitHub repository**

  Go to your repo on GitHub → Settings → Secrets and variables → Actions → New repository secret. Add:
  - `VITE_SUPABASE_URL` — your Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

- [ ] **Step 2: Find your GitHub Actions workflow file**

  Run: `ls .github/workflows/`

  Open the workflow file (likely `deploy.yml` or similar).

- [ ] **Step 3: Add env vars to the build step**

  In the workflow file, find the step that contains `run: npm run build`. Add an `env:` block as a sibling key to the existing `run:` line (do not replace the step, just add `env:` to it):

  ```yaml
  - run: npm run build
    env:
      VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  ```

  If the step already has a `name:` field, keep it — just add `env:` alongside `run:`.

- [ ] **Step 4: Commit and push**

  ```bash
  git add .github/workflows/
  git commit -m "ci: inject Supabase env vars in GitHub Actions build"
  git push
  ```

  Expected: GitHub Actions runs, build succeeds, deployed app works with auth.

- [ ] **Step 5: Verify production**

  Open the deployed GitHub Pages URL. Confirm login page appears and auth works end-to-end.
