# Backend Migration Design
**Date:** 2026-03-10
**Status:** Approved

## Overview

Migrate app state from Zustand `persist` (localStorage) to a Supabase backend with email/password authentication. All existing game logic stays client-side — only persistence and auth are added.

## Approach

**Single JSON blob in Supabase.** Store the entire `AppState` as one JSONB column per user. Zustand remains the source of truth for UI; Supabase is the durable store. No business logic moves to the backend.

## Database Schema

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

One row per user. `state` holds the full `AppState` JSON (minus `pendingUnlocks`).

## Auth Flow

- Email + password via Supabase Auth
- Single `/login` page with two tabs: Login and Register
- Loading screen on startup while session is resolved (no unauthenticated flash)
- Logout clears Zustand state and redirects to `/login`

## Migration of Existing localStorage Data

Triggered **on register only**:

1. After successful registration, read `localStorage['habit-tracker-store']`
2. If data exists → show modal: *"Знайдено дані на цьому пристрої. Перенести їх в акаунт?"*
3. **Yes** → upsert localStorage state to Supabase → clear localStorage key
4. **Ні** → start fresh, clear localStorage key

On login: fetch Supabase state only, no migration logic.

## Sync Layer

Replaces Zustand `persist` middleware entirely.

**Loading (on login):**
- Fetch user's row from `user_state`
- Call `importState()` to hydrate the store
- If no row exists, store keeps defaults

**Saving (after mutations):**
- Zustand `subscribe()` watches all store changes
- 1.5s debounce: resets on each change, then upserts state blob to Supabase
- Rapid actions (e.g. completing multiple habits) produce a single DB write

**On tab close:**
- `window.beforeunload` flushes any pending debounced write immediately

**What is synced:**
- Everything in `AppState` except `pendingUnlocks` (UI-only drain queue)

## New Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client init |
| `src/lib/stateSync.ts` | Load/save state blob, debounce logic |
| `src/store/useAuthStore.ts` | Auth state: `{ user, loading }` |
| `src/pages/LoginPage.tsx` | Login + register form (two tabs) |
| `src/components/AuthGuard.tsx` | Redirects to `/login` if no session |

## Modified Files

| File | Change |
|------|--------|
| `src/store/useAppStore.ts` | Remove `persist` middleware, subscribe to trigger sync |
| `src/main.tsx` / router | Add `/login` route, wrap app in `AuthGuard` |
| Existing settings/nav area | Add logout button |

## Out of Scope

- Offline support / sync queue
- Social login (Google, GitHub)
- Server-side business logic validation
- Multi-device conflict resolution
