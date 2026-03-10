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
  // Note: saveState is async but beforeunload cannot await Promises — this is best-effort.
  if (pendingSave) {
    if (debounceTimer) clearTimeout(debounceTimer)
    pendingSave()
    pendingSave = null
    debounceTimer = null
  }
}
