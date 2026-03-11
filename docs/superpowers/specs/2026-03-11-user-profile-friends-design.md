# User Profile & Friends Feature — Design Spec
**Date:** 2026-03-11
**Status:** Approved

---

## Overview

Add a user profile system with username/avatar customisation and a one-sided following system that lets users browse friends' squads and collections. Built on the existing Supabase + `user_state` architecture.

---

## Database

### `user_state` table — new columns
- `username TEXT UNIQUE` — display name chosen by user
- `avatar_url TEXT NULL` — URL to uploaded avatar in Supabase Storage; null means use default

### Supabase Storage
- New bucket: `avatars` (public read, authenticated write)
- File path convention: `{user_id}/{filename}`
- Max file size: ~2MB

### AppState changes
- Add `following: string[]` — array of user_ids the current user follows
- Persisted inside the existing `state` JSON blob in `user_state`

### No new tables required.

---

## User Settings

**Entry point:** Profile icon button in the app header (top-right corner).
**Container:** Modal or slide-in panel.

**Contents:**

1. **Username field**
   - Text input pre-filled with current username
   - Save button triggers `UPDATE user_state SET username = ? WHERE user_id = ?`
   - Validates uniqueness before saving (`SELECT count(*) WHERE username = ? AND user_id != currentUser`)
   - Shows inline error if username already taken

2. **Avatar section**
   - Displays current avatar image or a default footballer emoji fallback
   - Two options:
     - **Preset grid** — footballer emojis from `footballers.ts` data; selecting one clears `avatar_url` and stores the emoji as a special `avatar_emoji` value
     - **Upload button** — file picker (image/*), uploads to `avatars/{user_id}/avatar`, saves resulting public URL to `avatar_url`

3. **Sign out button** at the bottom

Username and avatar updates use a targeted Supabase `UPDATE` on the new columns only — separate from the full JSON state upsert used by `stateSync.ts`.

---

## Friends / Following

### Friends Page (`/friends`)
New page added to the nav bar as "Друзі".

**Layout:**
- Search input at top — queries `SELECT user_id, username, avatar_url FROM user_state WHERE username ILIKE '%query%' AND user_id != currentUser LIMIT 20`
- Each result row: avatar + username + "Слідкувати" / "Відписатись" button
- Following is instant — adds/removes `user_id` from `following[]` in AppState and triggers `scheduleSave`
- Below search: list of all followed users (resolved from `following[]` by fetching their `username` + `avatar_url`)
- Tap a followed user → navigates to `/profile/:userId`

### Friend Profile Page (`/profile/:userId`)
Read-only view of another user's data.

**Data source:** Single Supabase query on page load:
```sql
SELECT state, username, avatar_url FROM user_state WHERE user_id = :userId
```

**Layout:**
- Header: avatar + username
- Their squad — reuse existing squad/formation display components, all interactions disabled
- Their collection — reuse existing collection grid components, read-only, no rarity filter needed

No real-time updates — data is fetched once on navigation.

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/ui/ProfileModal.tsx` | Settings modal (username, avatar, sign out) |
| `src/pages/Friends.tsx` | Friends page with search + following list |
| `src/pages/FriendProfile.tsx` | Read-only friend profile page |
| `src/lib/profileSync.ts` | Supabase helpers: `saveProfile()`, `searchUsers()`, `fetchUserProfile()` |

## Modified Files

| File | Change |
|------|--------|
| `src/types.ts` | Add `following: string[]` to `AppState`; add `avatar_emoji?: string` to a new `UserProfile` type |
| `src/store/useAppStore.ts` | Add `following` field with default `[]` |
| `src/App.tsx` | Add routes for `/friends` and `/profile/:userId`; add profile icon to header |
| `src/components/ui/Header.tsx` (or equivalent) | Add profile icon button that opens `ProfileModal` |

---

## Out of Scope (Future)

- Friend requests / mutual approval
- Autobattle with squads
- Real-time updates on friend profiles
- Notifications
