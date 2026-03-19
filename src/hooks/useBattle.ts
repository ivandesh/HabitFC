import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useAppStore } from '../store/useAppStore'
import type { Challenge, Match, SquadSnapshot } from '../types'
import {
  sendChallenge as apiSendChallenge,
  cancelChallenge as apiCancelChallenge,
  declineChallenge as apiDeclineChallenge,
  acceptChallenge as apiAcceptChallenge,
  fetchChallenges,
  fetchMatchHistory as apiFetchMatchHistory,
  hasClaimedReward as apiHasClaimedReward,
  hasPendingChallenge as apiHasPendingChallenge,
  createMatch,
  expireChallenges,
  fetchUnwatchedMatches,
} from '../lib/battleApi'
import { fetchUserProfile } from '../lib/profileSync'
import { simulateMatch, pickAutoBench } from '../lib/battleEngine'
import { createRng, hashSeed } from '../lib/seededRng'
import { getWatchedSet, markWatched } from '../lib/watchedMatches'

export function useBattle() {
  const user = useAuthStore(s => s.user)
  const state = useAppStore.getState

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [matchHistory, setMatchHistory] = useState<Match[]>([])
  const [unwatchedMatches, setUnwatchedMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id ?? ''

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      await expireChallenges(userId)
      const [ch, mh, uw] = await Promise.all([
        fetchChallenges(userId),
        apiFetchMatchHistory(userId),
        fetchUnwatchedMatches(userId),
      ])
      setChallenges(ch)
      setMatchHistory(mh)
      // Filter to truly unwatched
      const watched = getWatchedSet()
      const newUnwatched = uw.filter(m => !watched.has(m.id))
      setUnwatchedMatches(newUnwatched)

      // Auto-claim coins for challenger from unwatched matches
      for (const match of newUnwatched) {
        if (match.coinsAwardedTo.includes(userId)) {
          if (match.result === 'home_win') {
            useAppStore.getState().addCoins(100)
          } else if (match.result === 'draw') {
            useAppStore.getState().addCoins(50)
          }
          // Mark as watched so coins aren't double-claimed
          markWatched(match.id)
        }
      }
      // Update unwatched list after claiming
      const watchedAfterClaim = getWatchedSet()
      setUnwatchedMatches(newUnwatched.filter(m => !watchedAfterClaim.has(m.id)))
    } catch { /* silent */ }
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  function buildMySnapshot(): SquadSnapshot {
    const s = state()
    const squadIds = s.squad.filter((id): id is string => id !== null)
    return {
      squad: squadIds,
      formation: s.formation,
      coachId: s.assignedCoach ?? '',
      coachLevel: s.assignedCoach ? (s.coachCollection[s.assignedCoach] ?? 1) : 1,
      maxHabitStreak: Math.max(0, ...s.habits.map(h => h.streak)),
      bench: pickAutoBench(Object.keys(s.collection), squadIds),
    }
  }

  async function sendChallenge(friendId: string) {
    if (!userId) return
    const snap = buildMySnapshot()
    await apiSendChallenge(userId, friendId, snap)
    await refresh()
  }

  async function cancelChallenge(challengeId: string) {
    await apiCancelChallenge(challengeId)
    await refresh()
  }

  async function declineChallenge(challengeId: string) {
    await apiDeclineChallenge(challengeId)
    await refresh()
  }

  async function acceptChallengeAndSimulate(challenge: Challenge): Promise<Match> {
    // 1. Accept the challenge
    await apiAcceptChallenge(challenge.id)

    // 2. Build my squad snapshot
    const mySnap = buildMySnapshot()

    // 3. Generate match seed
    const matchSeed = `${challenge.challengerId}-${userId}-${Date.now()}`

    // 4. Simulate match
    const rng = createRng(hashSeed(matchSeed))
    const sim = simulateMatch(
      challenge.challengerSquad,  // home = challenger
      mySnap,                     // away = challenged (me)
      rng,
    )

    // 5. Determine coin rewards — once per day per player
    const coinsAwardedTo: string[] = []

    // Acceptor (me = away team): win or draw earns coins
    const myClaimed = await apiHasClaimedReward(userId, challenge.challengerId)
    if (!myClaimed) {
      if (sim.result === 'away_win') {
        coinsAwardedTo.push(userId)
        useAppStore.getState().addCoins(100)
      } else if (sim.result === 'draw') {
        coinsAwardedTo.push(userId)
        useAppStore.getState().addCoins(50)
      }
    }

    // Challenger (home team): win or draw earns coins (recorded for their next load)
    const challengerClaimed = await apiHasClaimedReward(challenge.challengerId, userId)
    if (!challengerClaimed) {
      if (sim.result === 'home_win' || sim.result === 'draw') {
        coinsAwardedTo.push(challenge.challengerId)
      }
    }


    // 6. Store match in DB
    const match = await createMatch({
      challengeId: challenge.id,
      challengerId: challenge.challengerId,
      challengedId: userId,
      challengerSquad: challenge.challengerSquad,
      challengedSquad: mySnap,
      matchSeed,
      events: sim.events,
      scoreHome: sim.scoreHome,
      scoreAway: sim.scoreAway,
      result: sim.result,
      coinsAwardedTo,
    })

    await refresh()
    return match
  }

  function markMatchWatched(matchId: string) {
    markWatched(matchId)
    setUnwatchedMatches(prev => prev.filter(m => m.id !== matchId))
  }

  async function canChallenge(friendId: string): Promise<{
    canChallenge: boolean
    reason?: string
  }> {
    const s = state()
    const filledSlots = s.squad.filter(id => id !== null).length
    if (filledSlots < 11) return { canChallenge: false, reason: 'Заповніть склад (11/11)' }
    if (!s.assignedCoach) return { canChallenge: false, reason: 'Призначте тренера' }

    // Check friend's squad
    const profile = await fetchUserProfile(friendId)
    if (!profile) return { canChallenge: false, reason: 'Профіль не знайдено' }
    const friendState = profile.state
    const friendFilled = (friendState.squad ?? []).filter((id: string | null) => id !== null).length
    if (friendFilled < 11) return { canChallenge: false, reason: 'У друга неповний склад' }
    if (!friendState.assignedCoach) return { canChallenge: false, reason: 'У друга немає тренера' }

    const pending = await apiHasPendingChallenge(userId, friendId)
    if (pending) return { canChallenge: false, reason: 'Виклик вже відправлено' }

    return { canChallenge: true }
  }

  return {
    challenges,
    matchHistory,
    unwatchedMatches,
    loading,
    refresh,
    sendChallenge,
    cancelChallenge,
    declineChallenge,
    acceptChallengeAndSimulate,
    markMatchWatched,
    canChallenge,
    incomingChallenges: challenges.filter(c => c.challengedId === userId),
    outgoingChallenges: challenges.filter(c => c.challengerId === userId),
  }
}
