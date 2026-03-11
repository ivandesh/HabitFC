import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
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
