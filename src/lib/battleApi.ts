import { supabase } from './supabase'
import type { Challenge, Match, SquadSnapshot, MatchEvent, MatchResult, ChallengeStatus } from '../types'

// ─── Row → Domain Mappers ───────────────────────────────────────────────────

interface ChallengeRow {
  id: string
  challenger_id: string
  challenged_id: string
  status: ChallengeStatus
  challenger_squad: Challenge['challengerSquad']
  created_at: string
  expires_at: string
}

interface MatchRow {
  id: string
  challenge_id: string
  challenger_id: string
  challenged_id: string
  challenger_squad: Match['challengerSquad']
  challenged_squad: Match['challengedSquad']
  match_seed: string
  events: MatchEvent[]
  score_home: number
  score_away: number
  result: MatchResult
  coins_awarded_to: string[] | null
  played_at: string
}

function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    challengerId: row.challenger_id,
    challengedId: row.challenged_id,
    status: row.status,
    challengerSquad: row.challenger_squad,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

function toMatch(row: MatchRow): Match {
  return {
    id: row.id,
    challengeId: row.challenge_id,
    challengerId: row.challenger_id,
    challengedId: row.challenged_id,
    challengerSquad: row.challenger_squad,
    challengedSquad: row.challenged_squad,
    matchSeed: row.match_seed,
    events: row.events,
    scoreHome: row.score_home,
    scoreAway: row.score_away,
    result: row.result,
    coinsAwardedTo: row.coins_awarded_to ?? [],
    playedAt: row.played_at,
  }
}

// ─── Challenges ─────────────────────────────────────────────────────────────

export async function sendChallenge(
  challengerId: string,
  challengedId: string,
  challengerSquad: SquadSnapshot,
): Promise<Challenge> {
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      challenger_id: challengerId,
      challenged_id: challengedId,
      challenger_squad: challengerSquad,
    })
    .select()
    .single()
  if (error) throw error
  return toChallenge(data)
}

export async function cancelChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', challengeId)
    .eq('status', 'pending')
  if (error) throw error
}

export async function declineChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', challengeId)
    .eq('status', 'pending')
  if (error) throw error
}

export async function acceptChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', challengeId)
    .eq('status', 'pending')
  if (error) throw error
}

/** Fetch all pending challenges involving the current user */
export async function fetchChallenges(userId: string): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('status', 'pending')
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toChallenge)
}

/** Check if there's already a pending challenge between two users */
export async function hasPendingChallenge(
  userId: string,
  friendId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from('challenges')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .or(
      `and(challenger_id.eq.${userId},challenged_id.eq.${friendId}),` +
      `and(challenger_id.eq.${friendId},challenged_id.eq.${userId})`
    )
  if (error) throw error
  return (count ?? 0) > 0
}

/** Expire old pending challenges */
export async function expireChallenges(userId: string): Promise<void> {
  const { error } = await supabase
    .from('challenges')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .lt('expires_at', new Date().toISOString())
  if (error) throw error
}

// ─── Matches ────────────────────────────────────────────────────────────────

export async function createMatch(params: {
  challengeId: string
  challengerId: string
  challengedId: string
  challengerSquad: SquadSnapshot
  challengedSquad: SquadSnapshot
  matchSeed: string
  events: MatchEvent[]
  scoreHome: number
  scoreAway: number
  result: MatchResult
  coinsAwardedTo: string[]
}): Promise<Match> {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      challenge_id: params.challengeId,
      challenger_id: params.challengerId,
      challenged_id: params.challengedId,
      challenger_squad: params.challengerSquad,
      challenged_squad: params.challengedSquad,
      match_seed: params.matchSeed,
      events: params.events,
      score_home: params.scoreHome,
      score_away: params.scoreAway,
      result: params.result,
      coins_awarded_to: params.coinsAwardedTo,
    })
    .select()
    .single()
  if (error) throw error
  return toMatch(data)
}

export async function fetchMatchHistory(
  userId: string,
  limit = 50,
): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
    .order('played_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(toMatch)
}

/** Check if first-match reward has been claimed against a specific opponent */
export async function hasClaimedReward(
  userId: string,
  opponentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('matches')
    .select('coins_awarded_to')
    .or(
      `and(challenger_id.eq.${userId},challenged_id.eq.${opponentId}),` +
      `and(challenger_id.eq.${opponentId},challenged_id.eq.${userId})`
    )
  if (error) throw error
  return (data ?? []).some(row =>
    (row.coins_awarded_to as string[]).includes(userId)
  )
}

/** Fetch unwatched matches for the challenger (matches they haven't seen yet) */
export async function fetchUnwatchedMatches(userId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('challenger_id', userId)
    .order('played_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []).map(toMatch)
}
