# User Profile & Friends Feature — Design Spec
**Date:** 2026-03-11
**Status:** Approved

---

## Overview

Add a user profile system with username/avatar customisation and a one-sided following system that lets users browse friends' squads and collections. Built on the existing Supabase + `user_state` architecture.

---

## Database

### `user_state` table — new columns
- `username TEXT UNIQUE` — display name chosen by user; NULL until first set
- `avatar_url TEXT NULL` — URL to uploaded avatar in Supabase Storage; null means use preset emoji or default
- `avatar_emoji TEXT NULL` — selected preset emoji (e.g. "⚽"); used when `avatar_url` is null

### Supabase Storage
- New bucket: `avatars` (public read, authenticated write)
- File path convention: `{user_id}/avatar` (single file, overwritten on re-upload)
- Max file size: ~2MB

### AppState changes
- Add `following: string[]` — array of user_ids the current user follows
- Persisted inside the existing `state` JSON blob via `stateSync.ts`
- `following` must NOT be added to `EXCLUDED_KEYS` in `stateSync.ts` — it should be persisted

### Database migration
Run in Supabase SQL editor before deploying:
```sql
ALTER TABLE user_state ADD COLUMN username TEXT UNIQUE;
ALTER TABLE user_state ADD COLUMN avatar_url TEXT;
ALTER TABLE user_state ADD COLUMN avatar_emoji TEXT;
```

### Row-level security (RLS) — MVP approach
The existing SELECT policy restricts reads to `user_id = auth.uid()`. For this feature, we need authenticated users to read any row (to enable search and friend profile views, including the full `state` column for squad/collection display). Game state data is not sensitive.

Migration: **drop the existing restrictive SELECT policy and replace it with a permissive one**:
```sql
-- Drop existing restrictive SELECT policy (adjust name if different)
DROP POLICY IF EXISTS "Users can only access own data." ON user_state;

-- Allow any authenticated user to read any row
CREATE POLICY "authenticated users can read all profiles" ON user_state
  FOR SELECT TO authenticated
  USING (true);

-- Keep write operations restricted to own row (INSERT/UPDATE/DELETE policies unchanged)
```

This means any logged-in user can read any other user's full state. This is acceptable for MVP.

---

## User Settings

**Entry point:**
- **Desktop** (`NavBar` in `App.tsx`): profile icon button (👤) in the top-right of the nav bar, opens `ProfileModal`
- **Mobile** (`BottomNav` in `App.tsx`): no profile icon in BottomNav. Instead, a small profile icon button is shown at the top of the Friends page (`Friends.tsx`), opening `ProfileModal`. This keeps BottomNav at 6 tabs total (existing 5 + Friends).

**Container:** Modal (same pattern as other modals in the app).

**Contents:**

1. **Username field**
   - Text input pre-filled with current `username`; placeholder "Введіть ім'я" if null
   - Save button triggers:
     ```sql
     UPDATE user_state SET username = ? WHERE user_id = ?
     ```
   - Do NOT pre-validate uniqueness. Attempt the UPDATE and catch Postgres unique constraint violation (`error.code === '23505'`). Show inline error "Це ім'я вже зайняте".

2. **Avatar section**
   - Avatar display priority: `avatar_url` image → `avatar_emoji` emoji → "👤" default
   - Two options:
     - **Preset grid** — hardcoded list: `⚽ 🏆 🥅 🧤 👟 ⭐ 🌟 🔥 💪 🦁 🐺 🦅 🎯 🏅 🎽`. Selecting one:
       ```sql
       UPDATE user_state SET avatar_emoji = ?, avatar_url = NULL WHERE user_id = ?
       ```
     - **Upload button** — file picker (`accept="image/*"`), uploads to `avatars/{user_id}/avatar`, then:
       ```sql
       UPDATE user_state SET avatar_url = ?, avatar_emoji = NULL WHERE user_id = ?
       ```

3. **Sign out button** at the bottom

All profile column updates use a targeted Supabase UPDATE separate from the full JSON state upsert in `stateSync.ts`.

---

## Friends / Following

### Friends Page (`/friends`)
New route. Added to `NavBar` as "Друзі" (desktop) and to `BottomNav` as a 6th tab with a 👥 icon and label "Друзі" (mobile). This brings BottomNav to **6 tabs** — adjust `flex-1` layout to fit. A small profile icon button (👤) in the top-right of this page opens `ProfileModal` on mobile.

**Layout:**
- Search input at top. Query fires when input length ≥ 2.
  ```sql
  SELECT user_id, username, avatar_url, avatar_emoji
  FROM user_state
  WHERE username ILIKE '%query%' AND user_id != :currentUser
  LIMIT 20
  ```
  Users with `username = NULL` are excluded by the ILIKE match automatically.
- Each result row: avatar + username + "Слідкувати" / "Відписатись" toggle
- Following/unfollowing updates `following[]` in AppState and calls `scheduleSave`

**Following list (below search):**
- On page load, if `following` is non-empty, call `fetchFollowingProfiles(ids)`. If empty, skip query and show "Ви ще нікого не відстежуєте".
- `fetchFollowingProfiles` returns only users that exist and have a non-null username. Followed user_ids with no matching row (deleted accounts) or null username are silently filtered out.
- Each row: avatar + username, tappable → `/profile/:userId`

### Friend Profile Page (`/profile/:userId`)
Read-only view fetched live on navigation via `fetchUserProfile(userId)`.

**BottomNav visibility:** Hide `BottomNav` on `/profile/:userId`, same as on `/open`. Add `pathname.startsWith('/profile/')` to the existing hide condition in `BottomNav` in `App.tsx`.

**Layout:**
- Header: avatar + username
- **Squad view** — render a simplified read-only formation grid inline in `FriendProfile.tsx`. Do not reuse `Team.tsx` (monolithic page). Copy/extract just the grid rendering — no drag-and-drop, no click handlers.
- **Collection view** — render a simplified read-only card grid inline. Show only owned cards (skip locked placeholders). No rarity filter. No interactions.

No real-time updates — data fetched once on navigation.

---

## `src/lib/profileSync.ts` — function signatures

```ts
// Save username — catch error.code === '23505' for duplicate
saveUsername(userId: string, username: string): Promise<void>

// Save avatar_url (clears avatar_emoji)
saveAvatarUrl(userId: string, url: string): Promise<void>

// Save avatar_emoji (clears avatar_url)
saveAvatarEmoji(userId: string, emoji: string): Promise<void>

// Upload avatar file to Supabase Storage, return public URL
uploadAvatar(userId: string, file: File): Promise<string>

// Search users by username (min 2 chars, excludes current user)
searchUsers(query: string, currentUserId: string): Promise<ProfileRow[]>

// Fetch a single user's full profile + state
fetchUserProfile(userId: string): Promise<{ username: string; avatar_url: string | null; avatar_emoji: string | null; state: AppState } | null>

// Fetch multiple profiles. Returns [] immediately if ids is empty.
// Filters out rows with null username.
fetchFollowingProfiles(ids: string[]): Promise<ProfileRow[]>

type ProfileRow = { user_id: string; username: string; avatar_url: string | null; avatar_emoji: string | null }
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/ui/ProfileModal.tsx` | Settings modal (username, avatar, sign out) |
| `src/pages/Friends.tsx` | Friends page with search + following list + profile button |
| `src/pages/FriendProfile.tsx` | Read-only friend profile (inline squad + collection) |
| `src/lib/profileSync.ts` | Supabase helpers for profile and following queries |

## Modified Files

| File | Change |
|------|--------|
| `src/types.ts` | Add `following: string[]` to `AppState` |
| `src/store/useAppStore.ts` | Add `following: []` default; in the `loadState` merge handler, guard against missing key: `following: loaded.following ?? []` |
| `src/App.tsx` | Add routes `/friends` and `/profile/:userId`; add profile icon to `NavBar`; add Friends as 6th tab to `BottomNav` |

---

## Out of Scope (Future)

- Friend requests / mutual approval
- Autobattle with squads
- Real-time updates on friend profiles
- Notifications
- Column-level RLS (deferred; MVP uses open SELECT policy)
