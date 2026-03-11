# User Profile & Friends Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add username/avatar settings, a friends/following system, and a read-only friend profile view to the HabitFC app.

**Architecture:** Profile metadata (`username`, `avatar_url`, `avatar_emoji`) is stored as top-level columns on the existing `user_state` Supabase table. The `following` list (array of user_ids) lives inside the `state` JSON blob. A new `profileSync.ts` handles all profile-related Supabase queries. New pages `Friends` and `FriendProfile` are added to the router; `ProfileModal` is a settings overlay triggered from the nav.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Supabase JS v2 (`@supabase/supabase-js`), React Router v6, Zustand

**Spec:** `docs/superpowers/specs/2026-03-11-user-profile-friends-design.md`

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/lib/profileSync.ts` | Supabase helpers: save profile fields, search users, fetch profiles |
| Create | `src/components/ui/ProfileModal.tsx` | Settings modal: username, avatar, sign out |
| Create | `src/pages/Friends.tsx` | Friends page: search + following list |
| Create | `src/pages/FriendProfile.tsx` | Read-only friend profile: squad + collection |
| Modify | `src/types.ts` | Add `following: string[]` to `AppState` |
| Modify | `src/store/useAppStore.ts` | Add `following: []` default; fix `importState` merge |
| Modify | `src/App.tsx` | New routes; profile icon; Friends in nav + BottomNav |

---

## Chunk 1: Foundation — DB, Types, Store, profileSync

### Task 1: Run database migration in Supabase

**Files:** (no code — manual step)

- [ ] **Step 1: Open Supabase SQL editor**

  Go to your Supabase project → SQL Editor. Run:

  ```sql
  ALTER TABLE user_state ADD COLUMN username TEXT UNIQUE;
  ALTER TABLE user_state ADD COLUMN avatar_url TEXT;
  ALTER TABLE user_state ADD COLUMN avatar_emoji TEXT;
  ```

- [ ] **Step 2: Update RLS policies**

  In the same SQL editor, run:

  ```sql
  -- Drop the existing restrictive SELECT policy
  -- (name may differ — check Authentication > Policies if this fails)
  DROP POLICY IF EXISTS "Users can only access own data." ON user_state;

  -- Allow any authenticated user to read any row (MVP: state is not sensitive)
  CREATE POLICY "authenticated users can read all profiles" ON user_state
    FOR SELECT TO authenticated
    USING (true);
  ```

- [ ] **Step 3: Create Supabase Storage bucket**

  In Supabase → Storage, create a bucket named `avatars`:
  - Public bucket: ✅ (public read)
  - Allowed MIME types: `image/*`
  - Max file size: 2 MB

  Then add a Storage policy to allow authenticated users to upload:
  - Policy name: `authenticated users can upload avatars`
  - Operation: INSERT
  - Target roles: authenticated
  - Using expression: `bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]`

- [ ] **Step 4: Verify**

  Run in SQL editor:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'user_state'
  AND column_name IN ('username', 'avatar_url', 'avatar_emoji');
  ```
  Expected: 3 rows returned.

---

### Task 2: Add `following` to AppState and fix store

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: Add `following` to AppState in `src/types.ts`**

  Find the `AppState` interface (around line 34). Add `following` as the last field before the closing `}`:

  ```ts
  following: string[]           // user_ids this user follows
  ```

  Full updated interface end:
  ```ts
  export interface AppState {
    coins: number
    habits: Habit[]
    collection: Record<string, number>
    pullHistory: { footballerId: string; pulledAt: string }[]
    squad: (string | null)[]
    achievements: Record<string, { unlockedAt: string }>
    claimedAchievements: Record<string, true>
    totalCompletions: number
    formation: string
    pendingUnlocks: string[]
    pityCounters: Record<string, number>
    coachCollection: Record<string, number>
    assignedCoach: string | null
    following: string[]
  }
  ```

- [ ] **Step 2: Add `following` default to store in `src/store/useAppStore.ts`**

  In the `create<AppStore>()(...)` object (around line 38), add after `assignedCoach: null,`:

  ```ts
  following: [],
  ```

- [ ] **Step 3: Fix `resetAll` to include `following`**

  In the `resetAll` action (around line 206), add to the `set({...})` object:

  ```ts
  following: [],
  ```

- [ ] **Step 4: Fix `importState` to merge `following` safely**

  In the `importState` action (around line 224), add after `assignedCoach`:

  ```ts
  following: data.following ?? [],
  ```

- [ ] **Step 5: Verify `following` is NOT in `EXCLUDED_KEYS` in `src/lib/stateSync.ts`**

  Open `src/lib/stateSync.ts` and check the `EXCLUDED_KEYS` array near line 4:

  ```ts
  const EXCLUDED_KEYS: (keyof AppState)[] = ['pendingUnlocks']
  ```

  Confirm `following` is absent from this array. If it is present, remove it. `following` must be persisted.

- [ ] **Step 6: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no TypeScript errors. (Build may warn about other things but zero `following`-related errors.)

- [ ] **Step 7: Commit**

  ```bash
  git add src/types.ts src/store/useAppStore.ts
  git commit -m "feat: add following array to AppState"
  ```

---

### Task 3: Create `src/lib/profileSync.ts`

**Files:**
- Create: `src/lib/profileSync.ts`

- [ ] **Step 1: Create the file**

  ```ts
  import { supabase } from './supabase'
  import type { AppState } from '../types'

  export type ProfileRow = {
    user_id: string
    username: string
    avatar_url: string | null
    avatar_emoji: string | null
  }

  /** Save username. Throws on duplicate (catch error.code === '23505'). */
  export async function saveUsername(userId: string, username: string): Promise<void> {
    const { error } = await supabase
      .from('user_state')
      .update({ username })
      .eq('user_id', userId)
    if (error) throw error
  }

  /** Save avatar_url, clearing avatar_emoji. */
  export async function saveAvatarUrl(userId: string, url: string): Promise<void> {
    const { error } = await supabase
      .from('user_state')
      .update({ avatar_url: url, avatar_emoji: null })
      .eq('user_id', userId)
    if (error) throw error
  }

  /** Save avatar_emoji, clearing avatar_url. */
  export async function saveAvatarEmoji(userId: string, emoji: string): Promise<void> {
    const { error } = await supabase
      .from('user_state')
      .update({ avatar_emoji: emoji, avatar_url: null })
      .eq('user_id', userId)
    if (error) throw error
  }

  /** Upload an avatar image to Supabase Storage. Returns the public URL. */
  export async function uploadAvatar(userId: string, file: File): Promise<string> {
    const path = `${userId}/avatar`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // Bust cache with timestamp so re-uploads show immediately
    return `${data.publicUrl}?t=${Date.now()}`
  }

  /** Search users by username substring. Min 2 chars enforced by caller. Excludes current user. */
  export async function searchUsers(
    query: string,
    currentUserId: string
  ): Promise<ProfileRow[]> {
    const { data, error } = await supabase
      .from('user_state')
      .select('user_id, username, avatar_url, avatar_emoji')
      .ilike('username', `%${query}%`)
      .neq('user_id', currentUserId)
      .not('username', 'is', null)
      .limit(20)
    if (error) throw error
    return (data ?? []) as ProfileRow[]
  }

  /** Fetch a single user's profile + full game state. Returns null if not found. */
  export async function fetchUserProfile(userId: string): Promise<{
    username: string
    avatar_url: string | null
    avatar_emoji: string | null
    state: AppState
  } | null> {
    const { data, error } = await supabase
      .from('user_state')
      .select('username, avatar_url, avatar_emoji, state')
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    return {
      username: data.username,
      avatar_url: data.avatar_url,
      avatar_emoji: data.avatar_emoji,
      state: data.state as AppState,
    }
  }

  /**
   * Fetch profile data for multiple user_ids.
   * Returns [] immediately if ids is empty.
   * Filters out rows with null username.
   */
  export async function fetchFollowingProfiles(ids: string[]): Promise<ProfileRow[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('user_state')
      .select('user_id, username, avatar_url, avatar_emoji')
      .in('user_id', ids)
      .not('username', 'is', null)
    if (error) throw error
    return (data ?? []) as ProfileRow[]
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npm run build
  ```

  Expected: no errors in `profileSync.ts`.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/profileSync.ts
  git commit -m "feat: add profileSync helpers for user profile and following"
  ```

---

## Chunk 2: ProfileModal + App.tsx Nav

### Task 4: Create `ProfileModal` component

**Files:**
- Create: `src/components/ui/ProfileModal.tsx`

The modal uses the same overlay pattern as `AddHabitModal` (`fixed inset-0 bg-black/70 flex items-center justify-center z-50`), the same dark card style, and the same Oswald font for labels.

- [ ] **Step 1: Create `src/components/ui/ProfileModal.tsx`**

  ```tsx
  import { useState, useEffect, useRef } from 'react'
  import { useAuthStore } from '../../store/useAuthStore'
  import { saveUsername, saveAvatarUrl, saveAvatarEmoji, uploadAvatar } from '../../lib/profileSync'
  import { supabase } from '../../lib/supabase'

  const PRESET_EMOJIS = ['⚽', '🏆', '🥅', '🧤', '👟', '⭐', '🌟', '🔥', '💪', '🦁', '🐺', '🦅', '🎯', '🏅', '🎽']

  interface Props {
    onClose: () => void
  }

  /** Renders avatar image, emoji, or default icon based on priority */
  function Avatar({ url, emoji, size = 'lg' }: { url: string | null; emoji: string | null; size?: 'lg' | 'sm' }) {
    const dim = size === 'lg' ? 'w-16 h-16 text-3xl' : 'w-8 h-8 text-lg'
    if (url) {
      return <img src={url} alt="avatar" className={`${dim} rounded-full object-cover bg-[#0A0F1A]`} />
    }
    return (
      <div className={`${dim} rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center`}>
        {emoji ?? '👤'}
      </div>
    )
  }

  export function ProfileModal({ onClose }: Props) {
    const user = useAuthStore(state => state.user)
    const { signOut } = useAuthStore()

    // Profile state — loaded from DB on mount
    const [username, setUsername] = useState('')
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)

    // UI state
    const [usernameInput, setUsernameInput] = useState('')
    const [usernameError, setUsernameError] = useState<string | null>(null)
    const [usernameLoading, setUsernameLoading] = useState(false)
    const [avatarLoading, setAvatarLoading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    // Load current profile on mount
    useEffect(() => {
      if (!user) return
      supabase
        .from('user_state')
        .select('username, avatar_url, avatar_emoji')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUsername(data.username ?? '')
            setUsernameInput(data.username ?? '')
            setAvatarUrl(data.avatar_url ?? null)
            setAvatarEmoji(data.avatar_emoji ?? null)
          }
          setLoaded(true)
        })
    }, [user])

    async function handleSaveUsername() {
      if (!user || !usernameInput.trim()) return
      setUsernameLoading(true)
      setUsernameError(null)
      try {
        await saveUsername(user.id, usernameInput.trim())
        setUsername(usernameInput.trim())
      } catch (err: unknown) {
        const e = err as { code?: string }
        if (e?.code === '23505') {
          setUsernameError('Це ім\'я вже зайняте')
        } else {
          setUsernameError('Помилка збереження')
        }
      } finally {
        setUsernameLoading(false)
      }
    }

    async function handleSelectEmoji(emoji: string) {
      if (!user) return
      setAvatarLoading(true)
      try {
        await saveAvatarEmoji(user.id, emoji)
        setAvatarEmoji(emoji)
        setAvatarUrl(null)
      } finally {
        setAvatarLoading(false)
      }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (!file || !user) return
      setAvatarLoading(true)
      try {
        const url = await uploadAvatar(user.id, file)
        await saveAvatarUrl(user.id, url)
        setAvatarUrl(url)
        setAvatarEmoji(null)
      } finally {
        setAvatarLoading(false)
      }
    }

    if (!loaded) {
      return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="text-[#5A7090] font-oswald tracking-widest">ЗАВАНТАЖЕННЯ...</div>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-[#04060A] border border-[#1A2336] rounded-2xl p-6 w-full max-w-sm space-y-6"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-oswald text-xl font-bold uppercase tracking-wider text-white">Профіль</h2>
            <button onClick={onClose} className="text-[#5A7090] hover:text-white transition-colors text-xl cursor-pointer">✕</button>
          </div>

          {/* Current avatar display */}
          <div className="flex justify-center">
            <Avatar url={avatarUrl} emoji={avatarEmoji} size="lg" />
          </div>

          {/* Username */}
          <div>
            <label className="block font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-2">Ім'я гравця</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={usernameInput}
                onChange={e => { setUsernameInput(e.target.value); setUsernameError(null) }}
                placeholder="Введіть ім'я"
                maxLength={24}
                className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-3 py-2 text-sm text-white placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
              />
              <button
                onClick={handleSaveUsername}
                disabled={usernameLoading || !usernameInput.trim() || usernameInput.trim() === username}
                className="px-4 py-2 bg-[#00E676] text-[#04060A] font-oswald font-bold text-sm rounded-xl disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-opacity"
              >
                {usernameLoading ? '...' : 'Зберегти'}
              </button>
            </div>
            {usernameError && (
              <p className="text-red-400 text-xs mt-1">{usernameError}</p>
            )}
          </div>

          {/* Avatar section */}
          <div>
            <label className="block font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-2">Аватар</label>

            {/* Preset emoji grid */}
            <div className="grid grid-cols-5 gap-1.5 mb-3">
              {PRESET_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleSelectEmoji(emoji)}
                  disabled={avatarLoading}
                  className={`text-xl p-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
                    avatarEmoji === emoji && !avatarUrl
                      ? 'bg-[#00E676]/20 border border-[#00E676]'
                      : 'bg-[#0A0F1A] border border-[#1A2336] hover:border-[#00E676]/50'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Upload button */}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarLoading}
              className="w-full py-2 border border-dashed border-[#1A2336] rounded-xl font-oswald text-xs text-[#5A7090] hover:border-[#00E676]/50 hover:text-[#00E676] transition-colors cursor-pointer disabled:opacity-50"
            >
              {avatarLoading ? 'Завантаження...' : '📷 Завантажити фото'}
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut()}
            className="w-full py-2.5 border border-red-500/30 rounded-xl font-oswald text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            Вийти з акаунту
          </button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Build check**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/ui/ProfileModal.tsx
  git commit -m "feat: add ProfileModal component"
  ```

---

### Task 5: Update `App.tsx` — nav, routes, BottomNav

**Files:**
- Modify: `src/App.tsx`

This task adds: profile icon to desktop NavBar, Friends link to desktop NavBar, Friends 6th tab to BottomNav, hides BottomNav on `/profile/...`, and adds new routes for `/friends` and `/profile/:userId`.

- [ ] **Step 1: Add imports at the top of `src/App.tsx`**

  After the existing page imports, add:

  ```tsx
  import { Friends } from './pages/Friends'
  import { FriendProfile } from './pages/FriendProfile'
  import { ProfileModal } from './components/ui/ProfileModal'
  import { useState } from 'react'
  ```

  Note: `useState` may already be imported. Check existing imports — if `useEffect` is imported from react, just add `useState` to that import.

- [ ] **Step 2: Add a `FriendsIcon` SVG component** (after `TrophyIcon`, before `NavBar`)

  ```tsx
  const FriendsIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  )

  const ProfileIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  )
  ```

- [ ] **Step 3: Add `profileOpen` state to `NavBar`**

  Inside the `NavBar` function body, after the existing `const { signOut } = useAuthStore()` line, add:

  ```tsx
  const [profileOpen, setProfileOpen] = useState(false)
  ```

- [ ] **Step 4: Add Friends link and profile icon to the desktop nav**

  In the desktop nav `<div className="hidden sm:flex ...">`, after the Achievements NavLink:

  ```tsx
  <NavLink to="/friends" className={linkClass}>Друзі</NavLink>
  ```

  And in the `ml-auto` button group, before the sign-out button:

  ```tsx
  <button
    onClick={() => setProfileOpen(true)}
    className="p-2 text-[#5A7090] hover:text-[#00E676] transition-colors cursor-pointer"
    title="Профіль"
  >
    <ProfileIcon />
  </button>
  ```

  Also remove the standalone sign-out `🚪` button from desktop (since ProfileModal now has sign out), or keep it — your call. Keeping is fine.

- [ ] **Step 5: Render ProfileModal in `NavBar` return**

  The current `NavBar` has a bare `return (<nav ...>)`. **Replace the entire existing `return (...)` statement** with a fragment return so `ProfileModal` renders alongside the nav (not inside it):

  ```tsx
  return (
    <>
      <nav className="sticky top-0 z-40 bg-[#04060A]/95 backdrop-blur-md border-b border-[#1A2336]">
        {/* ... all existing nav content, unchanged ... */}
      </nav>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  )
  ```

- [ ] **Step 6: Update `BottomNav` to hide on `/profile/...`**

  Change line:
  ```tsx
  if (pathname === '/open') return null
  ```
  To:
  ```tsx
  if (pathname === '/open' || pathname.startsWith('/profile/')) return null
  ```

- [ ] **Step 7: Add Friends as 6th tab to `BottomNav`**

  After the Achievements tab NavLink, add:

  ```tsx
  <NavLink to="/friends" className={tabClass}>
    <FriendsIcon />
    <span className="font-oswald text-[9px] tracking-widest uppercase leading-none">Друзі</span>
  </NavLink>
  ```

- [ ] **Step 8: Add new routes to the router**

  In the `<Routes>` inside `AuthGuard`, add after the Achievements route:

  ```tsx
  <Route path="/friends" element={<Friends />} />
  <Route path="/profile/:userId" element={<FriendProfile />} />
  ```

- [ ] **Step 9: Build check**

  ```bash
  npm run build
  ```

  This will fail if `Friends.tsx` or `FriendProfile.tsx` don't exist yet. Create placeholder stubs first if needed:

  Stub for `src/pages/Friends.tsx`:
  ```tsx
  export function Friends() { return <div>Friends</div> }
  ```

  Stub for `src/pages/FriendProfile.tsx`:
  ```tsx
  export function FriendProfile() { return <div>Profile</div> }
  ```

  Then run `npm run build` — expected: no errors.

- [ ] **Step 10: Commit**

  ```bash
  git add src/App.tsx src/pages/Friends.tsx src/pages/FriendProfile.tsx
  git commit -m "feat: add profile icon, friends nav tab, new routes to App"
  ```

---

## Chunk 3: Friends Page

### Task 6: Implement `Friends.tsx`

**Files:**
- Modify: `src/pages/Friends.tsx` (replace stub)

The page has three sections: (1) a profile button row at top-right for mobile, (2) a search input that queries Supabase when ≥ 2 chars, (3) a following list resolved on mount.

- [ ] **Step 1: Write `src/pages/Friends.tsx`**

  ```tsx
  import { useState, useEffect, useRef } from 'react'
  import { useNavigate } from 'react-router-dom'
  import { useAppStore } from '../store/useAppStore'
  import { useAuthStore } from '../store/useAuthStore'
  import { scheduleSave } from '../lib/stateSync'
  import { searchUsers, fetchFollowingProfiles, type ProfileRow } from '../lib/profileSync'
  import { ProfileModal } from '../components/ui/ProfileModal'

  function AvatarSmall({ url, emoji }: { url: string | null; emoji: string | null }) {
    if (url) return <img src={url} alt="avatar" className="w-9 h-9 rounded-full object-cover bg-[#0A0F1A]" />
    return (
      <div className="w-9 h-9 rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center text-base">
        {emoji ?? '👤'}
      </div>
    )
  }

  function UserRow({
    row,
    isFollowing,
    onToggle,
    onNavigate,
  }: {
    row: ProfileRow
    isFollowing: boolean
    onToggle: (id: string) => void
    onNavigate: (id: string) => void
  }) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl cursor-pointer hover:border-[#00E676]/30 transition-colors"
        onClick={() => onNavigate(row.user_id)}
      >
        <AvatarSmall url={row.avatar_url} emoji={row.avatar_emoji} />
        <span className="flex-1 font-oswald font-bold text-white text-sm">{row.username}</span>
        <button
          onClick={e => { e.stopPropagation(); onToggle(row.user_id) }}
          className={`px-3 py-1 rounded-lg font-oswald text-xs font-bold transition-colors cursor-pointer ${
            isFollowing
              ? 'bg-[#1A2336] text-[#5A7090] hover:text-red-400'
              : 'bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] hover:bg-[#00E676]/20'
          }`}
        >
          {isFollowing ? 'Відписатись' : 'Слідкувати'}
        </button>
      </div>
    )
  }

  export function Friends() {
    const navigate = useNavigate()
    const user = useAuthStore(state => state.user)
    const following = useAppStore(state => state.following)
    const setFollowing = (ids: string[]) => {
      useAppStore.setState({ following: ids })
      if (user) scheduleSave(user.id, useAppStore.getState())
    }

    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState<ProfileRow[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [followingProfiles, setFollowingProfiles] = useState<ProfileRow[]>([])
    const [profileOpen, setProfileOpen] = useState(false)
    const initialLoadDone = useRef(false)

    // Load following profiles once — runs when `following` is first non-empty
    // (handles async store hydration from Supabase)
    useEffect(() => {
      if (initialLoadDone.current || following.length === 0) return
      initialLoadDone.current = true
      fetchFollowingProfiles(following).then(setFollowingProfiles)
    }, [following])

    // Debounced search
    useEffect(() => {
      if (query.length < 2) {
        setSearchResults([])
        return
      }
      const timer = setTimeout(async () => {
        if (!user) return
        setSearchLoading(true)
        try {
          const results = await searchUsers(query, user.id)
          setSearchResults(results)
        } finally {
          setSearchLoading(false)
        }
      }, 400)
      return () => clearTimeout(timer)
    }, [query, user])

    function handleToggleFollow(userId: string) {
      const isFollowing = following.includes(userId)
      const updated = isFollowing
        ? following.filter(id => id !== userId)
        : [...following, userId]
      setFollowing(updated)
      // Update followingProfiles list
      if (isFollowing) {
        setFollowingProfiles(prev => prev.filter(p => p.user_id !== userId))
      } else {
        // Add from search results if available
        const found = searchResults.find(r => r.user_id === userId)
        if (found) setFollowingProfiles(prev => [...prev, found])
      }
    }

    const followingSet = new Set(following)

    return (
      <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">· МЕРЕЖА ·</div>
            <h1 className="font-oswald text-2xl sm:text-4xl font-bold uppercase tracking-wide text-white">Друзі</h1>
          </div>
          {/* Profile button — visible on mobile where NavBar has no profile icon */}
          <button
            onClick={() => setProfileOpen(true)}
            className="sm:hidden w-10 h-10 rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center text-[#5A7090] hover:text-[#00E676] hover:border-[#00E676]/40 transition-colors cursor-pointer"
          >
            👤
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Пошук за ім'ям..."
            className="w-full bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5A7090] focus:outline-none focus:border-[#00E676] transition-colors"
          />
          {searchLoading && (
            <p className="text-[#5A7090] text-xs mt-2 font-oswald tracking-wider">ПОШУК...</p>
          )}
          {!searchLoading && query.length >= 2 && searchResults.length === 0 && (
            <p className="text-[#5A7090] text-xs mt-2">Нікого не знайдено</p>
          )}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map(row => (
                <UserRow
                  key={row.user_id}
                  row={row}
                  isFollowing={followingSet.has(row.user_id)}
                  onToggle={handleToggleFollow}
                  onNavigate={id => navigate(`/profile/${id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Following list */}
        <div>
          <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-3">
            Відстежую · {following.length}
          </div>
          {following.length === 0 ? (
            <p className="text-[#5A7090] text-sm">Ви ще нікого не відстежуєте</p>
          ) : (
            <div className="space-y-2">
              {followingProfiles.map(row => (
                <UserRow
                  key={row.user_id}
                  row={row}
                  isFollowing={true}
                  onToggle={handleToggleFollow}
                  onNavigate={id => navigate(`/profile/${id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      </div>
    )
  }
  ```

- [ ] **Step 2: Build check**

  ```bash
  npm run build
  ```

  Expected: no errors.

- [ ] **Step 3: Manual smoke test**

  ```bash
  npm run dev
  ```

  1. Navigate to `/friends`
  2. Confirm page loads with header and search input
  3. Type 1 char — no search fires
  4. Type 2+ chars — search fires after 400ms, results appear
  5. Click "Слідкувати" — button changes to "Відписатись", user appears in following list below
  6. Click "Відписатись" — removed from list
  7. Tap the 👤 button (mobile) or profile icon in nav (desktop) — ProfileModal opens

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/Friends.tsx
  git commit -m "feat: implement Friends page with search and following"
  ```

---

## Chunk 4: Friend Profile Page

### Task 7: Implement `FriendProfile.tsx`

**Files:**
- Modify: `src/pages/FriendProfile.tsx` (replace stub)

This page fetches the friend's full `state`, `username`, and avatar from Supabase, then renders a simplified read-only pitch grid (copied from `Team.tsx` rendering logic, no interactions) and a collection card grid.

The pitch/formation rendering reuses the `PitchSVG`, `playerOverall`, `PlayerPhoto`, `rarityRing`, `emptyBorder`, and `POS_UA` constants from Team.tsx — but since those are not exported, they must be duplicated or the values inlined here. Duplicate the minimal needed pieces inline in FriendProfile.tsx (it's only ~40 lines of constants and one small SVG).

- [ ] **Step 1: Write `src/pages/FriendProfile.tsx`**

  ```tsx
  import { useState, useEffect } from 'react'
  import { useParams, useNavigate } from 'react-router-dom'
  import { fetchUserProfile } from '../lib/profileSync'
  import { footballers } from '../data/footballers'
  import { FORMATIONS } from '../lib/formations'
  import { FootballerCard } from '../components/cards/FootballerCard'
  import type { AppState, Position } from '../types'

  // ── Pitch helpers (duplicated from Team.tsx — not exported there) ─────────────

  const POS_UA: Record<Position, string> = { GK: 'ВОР', DEF: 'ЗАХ', MID: 'ПЗА', FWD: 'НАП' }

  const rarityRing: Record<string, string> = {
    common:    'ring-gray-400/70',
    rare:      'ring-blue-400/80',
    epic:      'ring-pink-500/80',
    legendary: 'ring-yellow-400/90',
  }

  const emptyBorder: Record<Position, string> = {
    GK:  'border-yellow-400/50 text-yellow-400/70',
    DEF: 'border-blue-400/50 text-blue-400/70',
    MID: 'border-green-400/50 text-green-400/70',
    FWD: 'border-red-400/50 text-red-400/70',
  }

  function playerOverall(f: typeof footballers[0]) {
    return Math.round((f.stats.pace + f.stats.shooting + f.stats.passing + f.stats.dribbling) / 4)
  }

  function PlayerPhoto({ footballer }: { footballer: typeof footballers[0] }) {
    return footballer.photoUrl ? (
      <img
        src={`${import.meta.env.BASE_URL}${footballer.photoUrl.replace(/^\//, '')}`}
        alt={footballer.name}
        className="w-full h-full object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-lg">{footballer.emoji}</div>
    )
  }

  function PitchSVG() {
    return (
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        {[0,1,2,3,4,5,6,7].map(i => (
          <rect key={i} x="0" y={i * 50} width="300" height="50"
            fill={i % 2 === 0 ? 'transparent' : 'black'} fillOpacity="0.06" />
        ))}
        <rect x="12" y="12" width="276" height="376" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
        <line x1="12" y1="200" x2="288" y2="200" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
        <circle cx="150" cy="200" r="46" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
        <circle cx="150" cy="200" r="2.5" fill="white" fillOpacity="0.3" />
        <rect x="72" y="12" width="156" height="64" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
        <rect x="108" y="12" width="84" height="26" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
        <rect x="126" y="6" width="48" height="12" stroke="white" strokeOpacity="0.18" strokeWidth="1" />
        <rect x="72" y="324" width="156" height="64" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
        <rect x="108" y="362" width="84" height="26" stroke="white" strokeOpacity="0.12" strokeWidth="1" />
        <rect x="126" y="382" width="48" height="12" stroke="white" strokeOpacity="0.18" strokeWidth="1" />
        <circle cx="150" cy="60" r="2.5" fill="white" fillOpacity="0.3" />
        <circle cx="150" cy="340" r="2.5" fill="white" fillOpacity="0.3" />
        <path d="M 100 76 A 50 50 0 0 0 200 76" stroke="white" strokeOpacity="0.12" strokeWidth="1" fill="none" />
        <path d="M 100 324 A 50 50 0 0 1 200 324" stroke="white" strokeOpacity="0.12" strokeWidth="1" fill="none" />
      </svg>
    )
  }

  // ── Read-only pitch ────────────────────────────────────────────────────────────

  function ReadOnlyPitch({ squad, formation }: { squad: AppState['squad']; formation: string }) {
    const formationDef = FORMATIONS[formation] ?? FORMATIONS['4-3-3']
    const SLOTS = formationDef.slots

    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
        style={{ aspectRatio: '3/4', background: 'linear-gradient(180deg, #1b6133 0%, #1e6b38 45%, #1a5c30 55%, #196030 100%)' }}
      >
        <PitchSVG />
        {SLOTS.map((slot, idx) => {
          const footballerId = squad[idx] ?? null
          const footballer = footballerId ? footballers.find(f => f.id === footballerId) ?? null : null
          return (
            <div
              key={idx}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 z-10"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              {footballer ? (
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`relative w-10 h-10 sm:w-16 sm:h-16 rounded-full ring-2 overflow-hidden bg-[#0A0F1A] ${rarityRing[footballer.rarity]}`}>
                    <PlayerPhoto footballer={footballer} />
                  </div>
                  <div className="text-[9px] sm:text-[11px] text-white/85 font-bold leading-none max-w-[3rem] sm:max-w-[4.5rem] text-center truncate drop-shadow">
                    {footballer.name.split(' ').slice(-1)[0]}
                  </div>
                  <div className="text-[9px] sm:text-[11px] font-oswald font-bold text-[#00E676] leading-none drop-shadow">
                    {playerOverall(footballer)}
                  </div>
                </div>
              ) : (
                <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-full border-2 border-dashed flex items-center justify-center bg-black/25 ${emptyBorder[slot.pos]}`}>
                  <span className="text-[8px] sm:text-xs font-oswald font-bold">{POS_UA[slot.pos]}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Main page ──────────────────────────────────────────────────────────────────

  export function FriendProfile() {
    const { userId } = useParams<{ userId: string }>()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<{
      username: string
      avatar_url: string | null
      avatar_emoji: string | null
      state: AppState
    } | null>(null)

    useEffect(() => {
      if (!userId) return
      fetchUserProfile(userId)
        .then(data => {
          setProfile(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }, [userId])

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-[#5A7090] font-oswald tracking-widest">ЗАВАНТАЖЕННЯ...</div>
        </div>
      )
    }

    if (!profile) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="text-[#5A7090] font-oswald tracking-wider">Гравця не знайдено</div>
          <button onClick={() => navigate(-1)} className="text-[#00E676] font-oswald text-sm">← Назад</button>
        </div>
      )
    }

    const { username, avatar_url, avatar_emoji, state } = profile
    const squad = state.squad ?? Array(11).fill(null)
    const formation = state.formation ?? '4-3-3'
    const collection = state.collection ?? {}

    const ownedFootballers = footballers.filter(f => (collection[f.id] ?? 0) > 0)

    return (
      <div className="max-w-5xl mx-auto px-4 py-5 sm:py-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="text-[#5A7090] hover:text-[#00E676] font-oswald text-xs tracking-widest uppercase mb-6 transition-colors cursor-pointer"
        >
          ← Назад
        </button>

        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center overflow-hidden shrink-0">
            {avatar_url ? (
              <img src={avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">{avatar_emoji ?? '👤'}</span>
            )}
          </div>
          <div>
            <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">· ГРАВЕЦЬ ·</div>
            <h1 className="font-oswald text-2xl sm:text-4xl font-bold uppercase tracking-wide text-white">
              {username}
            </h1>
          </div>
        </div>

        {/* Squad */}
        <div className="mb-8">
          <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-3">
            Склад · {FORMATIONS[formation]?.label ?? formation}
          </div>
          <div className="max-w-[360px]">
            <ReadOnlyPitch squad={squad} formation={formation} />
          </div>
        </div>

        {/* Collection */}
        <div>
          <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-3">
            Колекція · {ownedFootballers.length} карток
          </div>
          {ownedFootballers.length === 0 ? (
            <p className="text-[#5A7090] text-sm">Колекція порожня</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {ownedFootballers.map(f => (
                <FootballerCard key={f.id} footballer={f} owned={collection[f.id]} mini />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Build check**

  ```bash
  npm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 3: Manual smoke test**

  ```bash
  npm run dev
  ```

  1. Go to `/friends`, search for a user who has state set up, follow them
  2. Click their name in the following list → navigates to `/profile/:userId`
  3. Confirm: avatar + username header, read-only pitch (no click interactions), collection grid
  4. Confirm BottomNav is hidden on this page
  5. Click "← Назад" → returns to Friends page

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/FriendProfile.tsx
  git commit -m "feat: implement FriendProfile read-only page with squad and collection"
  ```

---

## Final Verification

- [ ] **Step 1: Full build**

  ```bash
  npm run build
  ```

  Expected: successful build, zero TypeScript errors.

- [ ] **Step 2: End-to-end smoke test**

  ```bash
  npm run dev
  ```

  Test the complete flow:

  1. **Profile settings:**
     - Open ProfileModal (profile icon in NavBar or 👤 button on Friends page)
     - Set a username → confirm saved (reload page, reopen modal, username should be pre-filled)
     - Select a preset emoji avatar → confirm it shows in the modal header
     - Upload a photo → confirm it replaces the emoji
     - Try to set a username already taken → confirm "Це ім'я вже зайняте" error

  2. **Friends search:**
     - Navigate to `/friends`
     - Search for a user → results appear after 400ms
     - Follow a user → button changes to "Відписатись", user appears in following list
     - Unfollow → removed from list

  3. **Friend profile:**
     - Follow a user who has squad and collection data
     - Click their name → `/profile/:userId` loads
     - Squad grid shows their formation with their players (no click)
     - Collection grid shows their owned cards
     - BottomNav is hidden

  4. **Persistence:**
     - Follow a user, reload the page
     - Following list should still show that user (state was saved to Supabase)

- [ ] **Step 3: Final commit**

  ```bash
  git add -A
  git commit -m "feat: complete user profile and friends feature"
  ```
