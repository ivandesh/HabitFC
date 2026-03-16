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
    .ilike('username', `%${query.replace(/[%_]/g, '\\$&')}%`)
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
