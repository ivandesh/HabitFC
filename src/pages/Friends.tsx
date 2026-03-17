import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { searchUsers, fetchFollowingProfiles, type ProfileRow } from '../lib/profileSync'
import { ProfileModal } from '../components/ui/ProfileModal'
import { MatchLive } from '../components/battle/MatchLive'
import { useBattle } from '../hooks/useBattle'
import type { Match, Challenge } from '../types'

function AvatarSmall({ url, emoji }: { url: string | null; emoji: string | null }) {
  if (url) return <img src={url} alt="avatar" className="w-9 h-9 rounded-full object-cover bg-[#0A0F1A]" />
  return (
    <div className="w-9 h-9 rounded-full bg-[#0A0F1A] border border-[#1A2336] flex items-center justify-center text-base">
      {emoji ?? '👤'}
    </div>
  )
}

function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return <span className="text-red-400 text-xs">Закінчився</span>
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return <span className="text-[#5A7090] text-xs">{hours}г {mins}хв</span>
}

export function Friends() {
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const following = useAppStore(state => state.following)
  const setFollowing = useAppStore(state => state.setFollowing)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [followingProfiles, setFollowingProfiles] = useState<ProfileRow[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const initialLoadDone = useRef(false)

  // Battle state
  const battle = useBattle()
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [challengeLoading, setChallengeLoading] = useState<string | null>(null)
  const [activeMatchNames, setActiveMatchNames] = useState<{ home: string; away: string }>({
    home: '', away: '',
  })
  const [viewerTeam, setViewerTeam] = useState<'home' | 'away'>('home')

  // Load following profiles once
  useEffect(() => {
    if (initialLoadDone.current || following.length === 0) return
    initialLoadDone.current = true
    fetchFollowingProfiles(following).then(setFollowingProfiles).catch(() => {})
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
      } catch {
        setSearchResults([])
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
    if (isFollowing) {
      setFollowingProfiles(prev => prev.filter(p => p.user_id !== userId))
    } else {
      const found = searchResults.find(r => r.user_id === userId)
      if (found) setFollowingProfiles(prev => [...prev, found])
    }
  }

  async function handleSendChallenge(friendId: string) {
    setChallengeLoading(friendId)
    try {
      const check = await battle.canChallenge(friendId)
      if (!check.canChallenge) {
        alert(check.reason)
        return
      }
      await battle.sendChallenge(friendId)
    } catch {
      alert('Помилка відправки виклику')
    } finally {
      setChallengeLoading(null)
    }
  }

  async function handleAccept(challenge: Challenge) {
    setChallengeLoading(challenge.id)
    try {
      const match = await battle.acceptChallengeAndSimulate(challenge)
      const challengerProfile = followingProfiles.find(p => p.user_id === challenge.challengerId)
      setActiveMatchNames({
        home: challengerProfile?.username ?? 'Суперник',
        away: 'Ви',
      })
      setViewerTeam('away')
      setActiveMatch(match)
    } catch {
      alert('Помилка прийняття виклику')
    } finally {
      setChallengeLoading(null)
    }
  }

  function handleWatchMatch(match: Match) {
    const opponentId = match.challengerId === user?.id ? match.challengedId : match.challengerId
    const opponentProfile = followingProfiles.find(p => p.user_id === opponentId)
    setActiveMatchNames({
      home: match.challengerId === user?.id ? 'Ви' : (opponentProfile?.username ?? 'Суперник'),
      away: match.challengedId === user?.id ? 'Ви' : (opponentProfile?.username ?? 'Суперник'),
    })
    setViewerTeam(match.challengerId === user?.id ? 'home' : 'away')
    setActiveMatch(match)
  }

  function handleMatchFinish() {
    if (activeMatch) {
      battle.markMatchWatched(activeMatch.id)
    }
    setActiveMatch(null)
  }

  const followingSet = new Set(following)

  // If watching a match, show only the match
  if (activeMatch) {
    return (
      <MatchLive
        match={activeMatch}
        homeName={activeMatchNames.home}
        awayName={activeMatchNames.away}
        viewerTeam={viewerTeam}
        onFinish={handleMatchFinish}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">· МЕРЕЖА ·</div>
          <h1 className="font-oswald text-2xl sm:text-4xl font-bold uppercase tracking-wide text-white">Друзі</h1>
        </div>
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
              <div
                key={row.user_id}
                className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl cursor-pointer hover:border-[#00E676]/30 transition-colors"
                onClick={() => navigate(`/profile/${row.user_id}`)}
              >
                <AvatarSmall url={row.avatar_url} emoji={row.avatar_emoji} />
                <span className="flex-1 font-oswald font-bold text-white text-sm">{row.username}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleToggleFollow(row.user_id) }}
                  className={`px-3 py-1 rounded-lg font-oswald text-xs font-bold transition-colors cursor-pointer ${
                    followingSet.has(row.user_id)
                      ? 'bg-[#1A2336] text-[#5A7090] hover:text-red-400'
                      : 'bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] hover:bg-[#00E676]/20'
                  }`}
                >
                  {followingSet.has(row.user_id) ? 'Відписатись' : 'Слідкувати'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Following list with Challenge buttons */}
      <div className="mb-6">
        <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-3">
          Відстежую · {following.length}
        </div>
        {following.length === 0 ? (
          <p className="text-[#5A7090] text-sm">Ви ще нікого не відстежуєте</p>
        ) : (
          <div className="space-y-2">
            {followingProfiles.map(row => (
              <div
                key={row.user_id}
                className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl cursor-pointer hover:border-[#00E676]/30 transition-colors"
                onClick={() => navigate(`/profile/${row.user_id}`)}
              >
                <AvatarSmall url={row.avatar_url} emoji={row.avatar_emoji} />
                <span className="flex-1 font-oswald font-bold text-white text-sm">{row.username}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleSendChallenge(row.user_id) }}
                  disabled={challengeLoading === row.user_id}
                  className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-oswald text-xs font-bold hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50 mr-1"
                >
                  {challengeLoading === row.user_id ? '...' : '⚔️'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleToggleFollow(row.user_id) }}
                  className="px-3 py-1 rounded-lg font-oswald text-xs font-bold transition-colors cursor-pointer bg-[#1A2336] text-[#5A7090] hover:text-red-400"
                >
                  Відписатись
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming challenges */}
      {battle.incomingChallenges.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="font-oswald text-xs text-[#00E676] uppercase tracking-widest">
            Вхідні виклики
          </div>
          {battle.incomingChallenges.map(ch => {
            const challenger = followingProfiles.find(p => p.user_id === ch.challengerId)
            return (
              <div key={ch.id} className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl">
                <AvatarSmall url={challenger?.avatar_url ?? null} emoji={challenger?.avatar_emoji ?? null} />
                <div className="flex-1">
                  <div className="text-sm text-white font-bold">{challenger?.username ?? 'Гравець'}</div>
                  <TimeLeft expiresAt={ch.expiresAt} />
                </div>
                <button
                  onClick={() => handleAccept(ch)}
                  disabled={challengeLoading === ch.id}
                  className="px-3 py-1.5 bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] rounded-lg font-oswald text-xs font-bold hover:bg-[#00E676]/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {challengeLoading === ch.id ? '...' : 'ПРИЙНЯТИ'}
                </button>
                <button
                  onClick={() => battle.declineChallenge(ch.id)}
                  className="px-3 py-1.5 bg-[#1A2336] text-[#5A7090] rounded-lg font-oswald text-xs font-bold hover:text-red-400 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Outgoing challenges */}
      {battle.outgoingChallenges.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest">
            Відправлені виклики
          </div>
          {battle.outgoingChallenges.map(ch => {
            const challenged = followingProfiles.find(p => p.user_id === ch.challengedId)
            return (
              <div key={ch.id} className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl">
                <AvatarSmall url={challenged?.avatar_url ?? null} emoji={challenged?.avatar_emoji ?? null} />
                <div className="flex-1">
                  <div className="text-sm text-white">{challenged?.username ?? 'Гравець'}</div>
                  <TimeLeft expiresAt={ch.expiresAt} />
                </div>
                <button
                  onClick={() => battle.cancelChallenge(ch.id)}
                  className="px-3 py-1.5 bg-[#1A2336] text-[#5A7090] rounded-lg font-oswald text-xs font-bold hover:text-red-400 transition-colors cursor-pointer"
                >
                  СКАСУВАТИ
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Match History */}
      {battle.matchHistory.length > 0 && (
        <div className="mb-6">
          <div className="font-oswald text-xs text-[#5A7090] uppercase tracking-widest mb-3">
            Історія матчів
          </div>
          <div className="space-y-2">
            {battle.matchHistory.slice(0, 10).map(match => {
              const opponentId = match.challengerId === user?.id ? match.challengedId : match.challengerId
              const opponent = followingProfiles.find(p => p.user_id === opponentId)
              const isHome = match.challengerId === user?.id
              const myScore = isHome ? match.scoreHome : match.scoreAway
              const theirScore = isHome ? match.scoreAway : match.scoreHome
              const myResult = isHome
                ? match.result === 'home_win' ? 'W' : match.result === 'away_win' ? 'L' : 'D'
                : match.result === 'away_win' ? 'W' : match.result === 'home_win' ? 'L' : 'D'
              const resultColor = myResult === 'W' ? 'text-[#00E676] bg-[#00E676]/10' :
                myResult === 'L' ? 'text-red-400 bg-red-400/10' : 'text-yellow-400 bg-yellow-400/10'

              return (
                <div
                  key={match.id}
                  onClick={() => handleWatchMatch(match)}
                  className="flex items-center gap-3 px-4 py-3 bg-[#0A0F1A] border border-[#1A2336] rounded-xl cursor-pointer hover:border-[#00E676]/20 transition-colors"
                >
                  <span className={`font-oswald text-xs font-bold w-6 h-6 rounded flex items-center justify-center ${resultColor}`}>
                    {myResult}
                  </span>
                  <span className="flex-1 text-sm text-white">
                    vs {opponent?.username ?? 'Суперник'}
                  </span>
                  <span className="font-oswald text-sm text-white font-bold">
                    {myScore} — {theirScore}
                  </span>
                  <span className="text-[#5A7090] text-xs">
                    {new Date(match.playedAt).toLocaleDateString('uk-UA')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
