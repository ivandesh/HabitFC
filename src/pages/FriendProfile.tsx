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
  const [error, setError] = useState(false)
  const [profile, setProfile] = useState<{
    username: string
    avatar_url: string | null
    avatar_emoji: string | null
    state: AppState
  } | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchUserProfile(userId)
      .then(data => {
        if (cancelled) return
        setProfile(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[#5A7090] font-oswald tracking-widest">ЗАВАНТАЖЕННЯ...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-[#5A7090] font-oswald tracking-wider">Помилка завантаження</div>
        <button onClick={() => navigate(-1)} className="text-[#00E676] font-oswald text-sm">← Назад</button>
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
  const squad = state.squad ?? Array<string | null>(11).fill(null)
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
            <img src={avatar_url} alt={username} className="w-full h-full object-cover" />
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
