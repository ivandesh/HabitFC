import { useState, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { footballers } from '../data/footballers'
import { CoinDisplay } from '../components/ui/CoinDisplay'
import { FORMATIONS, FORMATION_KEYS } from '../lib/formations'
import { computeActiveBonuses, totalBonusPercent } from '../lib/bonuses'
import type { AppState, Position, Footballer } from '../types'
import { coaches as allCoaches } from '../data/coaches'
import { computeCoachChemistryPct, getCoachLevel, applyCoachStatBoost } from '../lib/coachPerks'
import { CoachCard } from '../components/cards/CoachCard'
import type { FormationSlot } from '../lib/formations'

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

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#5A7090] w-16 shrink-0 font-oswald uppercase">{label}</span>
      <div className="flex-1 h-1.5 bg-[#1A2336] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[#00E676]"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-white w-6 text-right">{value}</span>
    </div>
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

interface ChemLink {
  from: number
  to: number
  type: 'club' | 'nation' | 'both'
  label: string
}

function getChemistryLinks(
  squad: (string | null)[],
  _slots: FormationSlot[]
): ChemLink[] {
  const links: ChemLink[] = []
  const players = squad.map(id => id ? footballers.find(f => f.id === id) ?? null : null)

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]
      const b = players[j]
      if (!a || !b) continue
      const sameClub = a.club === b.club
      const sameNat = a.nationality === b.nationality
      if (sameClub && sameNat) {
        links.push({ from: i, to: j, type: 'both', label: `${a.club} · ${a.nationality}` })
      } else if (sameClub) {
        links.push({ from: i, to: j, type: 'club', label: a.club })
      } else if (sameNat) {
        links.push({ from: i, to: j, type: 'nation', label: a.nationality })
      }
    }
  }
  return links
}

function ChemistryLines({ links, slots }: { links: ChemLink[]; slots: FormationSlot[] }) {
  if (links.length === 0) return null
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 100 100" preserveAspectRatio="none">
      {links.map((link, i) => {
        const fromSlot = slots[link.from]
        const toSlot = slots[link.to]
        const color = link.type === 'both' ? '#E879F9' : link.type === 'club' ? '#00E676' : '#FBBF24'
        return (
          <line
            key={i}
            x1={fromSlot.x} y1={fromSlot.y}
            x2={toSlot.x} y2={toSlot.y}
            stroke={color} strokeWidth="0.6" strokeOpacity="0.5"
            strokeDasharray="1.5 1"
          />
        )
      })}
    </svg>
  )
}

function computeChemistryDelta(
  currentSquad: (string | null)[],
  slotIndex: number,
  candidateId: string
): number {
  const currentPct = totalBonusPercent(
    computeActiveBonuses({ squad: currentSquad } as AppState)
  )
  const newSquad = [...currentSquad]
  newSquad[slotIndex] = candidateId
  const newPct = totalBonusPercent(
    computeActiveBonuses({ squad: newSquad } as AppState)
  )
  return newPct - currentPct
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

type PanelMode = 'idle' | 'pick' | 'stats'

export function Team() {
  const squad = useAppStore(state => state.squad ?? Array(11).fill(null))
  const formation = useAppStore(state => state.formation ?? '4-3-3')
  const setSquadSlot = useAppStore(state => state.setSquadSlot)
  const setFormation = useAppStore(state => state.setFormation)
  const collection = useAppStore(state => state.collection)
  const squadForBonuses = useAppStore(state => state.squad)

  const coachCollection = useAppStore(state => state.coachCollection)
  const assignedCoach = useAppStore(state => state.assignedCoach)
  const assignCoach = useAppStore(state => state.assignCoach)
  const [coachPickerOpen, setCoachPickerOpen] = useState(false)

  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>('idle')

  const formationDef = FORMATIONS[formation] ?? FORMATIONS['4-3-3']
  const SLOTS = formationDef.slots

  const ownedIds = useMemo(
    () => new Set(Object.keys(collection).filter(id => (collection[id] ?? 0) > 0)),
    [collection]
  )

  const filledPlayers = useMemo(() =>
    squad
      .filter((id): id is string => id !== null)
      .map(id => footballers.find(f => f.id === id)!)
      .filter(Boolean),
    [squad]
  )

  const teamOverall = useMemo(() => {
    if (filledPlayers.length === 0) return 0
    return Math.round(filledPlayers.reduce((s, f) => s + playerOverall(f), 0) / filledPlayers.length)
  }, [filledPlayers])

  const activeBonuses = useMemo(() => computeActiveBonuses({ squad: squadForBonuses } as AppState), [squadForBonuses])
  const bonusPct = totalBonusPercent(activeBonuses)

  const assignedCoachObj = useMemo(
    () => assignedCoach ? allCoaches.find(c => c.id === assignedCoach) ?? null : null,
    [assignedCoach]
  )

  const coachChemPct = useMemo(() => {
    if (!assignedCoachObj) return 0
    return computeCoachChemistryPct(assignedCoachObj, filledPlayers)
  }, [assignedCoachObj, filledPlayers])

  const coachLevel = assignedCoach ? getCoachLevel(assignedCoach, coachCollection) : 0

  function boostedFootballer(f: Footballer) {
    return applyCoachStatBoost(f, { assignedCoach, coachCollection } as AppState)
  }

  const chemLinks = useMemo(() => getChemistryLinks(squad, SLOTS), [squad, SLOTS])

  const activeSlotDef = activeSlot !== null ? SLOTS[activeSlot] : null

  const pickerPlayers = useMemo(() => {
    if (!activeSlotDef) return []
    return footballers
      .filter(f => f.position === activeSlotDef.pos && ownedIds.has(f.id))
      .sort((a, b) => playerOverall(b) - playerOverall(a))
  }, [activeSlotDef, ownedIds])

  function handleSlotClick(idx: number) {
    const footballerId = squad[idx] ?? null
    if (footballerId) {
      setActiveSlot(idx)
      setPanelMode('stats')
    } else {
      if (activeSlot === idx) {
        setActiveSlot(null)
        setPanelMode('idle')
      } else {
        setActiveSlot(idx)
        setPanelMode('pick')
      }
    }
  }

  function handleSelectPlayer(footballerId: string) {
    if (activeSlot === null) return
    setSquadSlot(activeSlot, footballerId)
    setActiveSlot(null)
    setPanelMode('idle')
  }

  function handleRemoveFromStats() {
    if (activeSlot === null) return
    setSquadSlot(activeSlot, null)
    setActiveSlot(null)
    setPanelMode('idle')
  }

  function handleFormationChange(newFormation: string) {
    if (newFormation === formation) return
    const hasPlayers = squad.some(Boolean)
    if (hasPlayers && !window.confirm('Зміна схеми скине склад. Продовжити?')) return
    setFormation(newFormation)
    setActiveSlot(null)
    setPanelMode('idle')
  }

  function closePanel() {
    setActiveSlot(null)
    setPanelMode('idle')
  }

  const activePlayer = activeSlot !== null && panelMode === 'stats'
    ? footballers.find(f => f.id === squad[activeSlot]) ?? null
    : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="font-oswald text-xs tracking-[0.25em] text-[#00E676] uppercase mb-1">
            · {FORMATIONS[formation]?.label ?? formation} ·
          </div>
          <h1 className="font-oswald text-2xl sm:text-5xl font-bold uppercase tracking-wide text-white leading-none">
            Склад
          </h1>
          <p className="text-[#5A7090] mt-2 text-sm">{filledPlayers.length} / 11 гравців</p>
        </div>
        <CoinDisplay />
      </div>

      {/* Formation switcher */}
      <div className="flex gap-1 mb-4 bg-[#0A0F1A] border border-[#1A2336] rounded-xl p-1 overflow-x-auto hide-scrollbar">
        {FORMATION_KEYS.map(key => (
          <button
            key={key}
            onClick={() => handleFormationChange(key)}
            className={`flex-1 min-w-fit py-1.5 px-2 rounded-lg font-oswald font-bold text-xs tracking-wider transition-all cursor-pointer whitespace-nowrap ${
              formation === key
                ? 'bg-[#00E676] text-[#04060A]'
                : 'text-[#5A7090] hover:text-white'
            }`}
          >
            {FORMATIONS[key].label}
          </button>
        ))}
      </div>

      {/* Stats bar — column layout on mobile, row on sm+ */}
      <div className="flex gap-2 sm:gap-3 mb-4">
        <div className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center sm:items-center gap-0.5 sm:gap-3">
          <div className="font-oswald text-xl sm:text-3xl font-bold text-[#00E676]">
            {teamOverall || '—'}
          </div>
          <div className="text-center sm:text-left">
            <div className="hidden sm:block text-[10px] text-[#5A7090] uppercase tracking-wider">Загальний</div>
            <div className="hidden sm:block text-xs text-white font-semibold">рейтинг</div>
            <div className="sm:hidden font-oswald text-[8px] text-[#5A7090] uppercase tracking-widest">OVR</div>
          </div>
        </div>
        <div className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center sm:items-center gap-0.5 sm:gap-3">
          <div className="font-oswald text-xl sm:text-3xl font-bold text-[#FBBF24]">
            {(bonusPct + coachChemPct) > 0 ? `+${bonusPct + coachChemPct}%` : '—'}
          </div>
          <div className="text-center sm:text-left">
            <div className="hidden sm:block text-[10px] text-[#5A7090] uppercase tracking-wider">Хімія</div>
            <div className="hidden sm:block text-xs text-white font-semibold">бонус монет</div>
            <div className="sm:hidden font-oswald text-[8px] text-[#5A7090] uppercase tracking-widest">ХІМ</div>
          </div>
        </div>
        <div className="flex-1 bg-[#0A0F1A] border border-[#1A2336] rounded-xl px-2 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-center sm:items-center gap-0.5 sm:gap-3">
          <div className="font-oswald text-xl sm:text-3xl font-bold text-[#A78BFA]">
            {filledPlayers.length}
          </div>
          <div className="text-center sm:text-left">
            <div className="hidden sm:block text-[10px] text-[#5A7090] uppercase tracking-wider">Складено</div>
            <div className="hidden sm:block text-xs text-white font-semibold">гравців</div>
            <div className="sm:hidden font-oswald text-[8px] text-[#5A7090] uppercase tracking-widest">ГРВ</div>
          </div>
        </div>
      </div>

      {/* Active bonuses panel */}
      {activeBonuses.length > 0 && (
        <div className="mb-4 bg-[#0A0F1A] border border-[#FBBF24]/20 rounded-xl px-4 py-3">
          <div className="text-[10px] text-[#5A7090] uppercase tracking-wider mb-2 font-oswald">Активні бонуси</div>
          <div className="flex flex-wrap gap-2">
            {activeBonuses.map((b, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-lg px-2 py-1">
                <span className="text-[10px] text-[#5A7090]">{b.label}</span>
                <span className="text-[10px] font-oswald font-bold text-[#FBBF24]">+{b.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coach chemistry stats row */}
      {coachChemPct > 0 && assignedCoachObj && (
        <div className="mb-4 bg-[#0A0F1A] border border-[#FBBF24]/20 rounded-xl px-4 py-3">
          <div className="text-[10px] text-[#5A7090] uppercase tracking-wider mb-2 font-oswald">Хімія тренера</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#5A7090]">{assignedCoachObj.name}</span>
            <span className="text-[10px] font-oswald font-bold text-[#FBBF24]">+{coachChemPct}%</span>
          </div>
        </div>
      )}

      {/* Coach slot */}
      <div className="mb-4">
        {assignedCoachObj ? (
          <div
            className="flex items-center gap-3 bg-[#0A0F1A] border border-[#FBBF24]/30 rounded-2xl px-4 py-3 cursor-pointer hover:border-[#FBBF24]/60 transition-colors"
            onClick={() => setCoachPickerOpen(true)}
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 ring-2 ring-[#FBBF24]/50 shrink-0">
              {assignedCoachObj.photoUrl ? (
                <img
                  src={`${import.meta.env.BASE_URL}${assignedCoachObj.photoUrl.replace(/^\//, '')}`}
                  alt={assignedCoachObj.name}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">{assignedCoachObj.emoji}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-oswald font-bold text-white text-sm truncate">{assignedCoachObj.name}</div>
              <div className="text-[10px] text-[#FBBF24]/70 truncate">
                {assignedCoachObj.perk.descUA[Math.max(0, coachLevel - 1)]}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="text-[#FBBF24] text-xs">{'★'.repeat(coachLevel)}{'☆'.repeat(3 - coachLevel)}</div>
              {coachChemPct > 0 && (
                <div className="text-[10px] font-oswald font-bold text-[#FBBF24]">+{coachChemPct}% хімія</div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCoachPickerOpen(true)}
            className="w-full py-3 border-2 border-dashed border-[#FBBF24]/30 rounded-2xl font-oswald text-sm text-[#FBBF24]/50 hover:border-[#FBBF24]/60 hover:text-[#FBBF24]/70 transition-colors cursor-pointer"
          >
            + Призначити тренера
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
        {/* Pitch */}
        <div className="w-full lg:w-1/2 max-w-[480px] mx-auto lg:mx-0 shrink-0">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
            style={{
              aspectRatio: '3/4',
              background: 'linear-gradient(180deg, #1b6133 0%, #1e6b38 45%, #1a5c30 55%, #196030 100%)',
            }}
          >
            <PitchSVG />
            <ChemistryLines links={chemLinks} slots={SLOTS} />
            {SLOTS.map((slot, idx) => {
              const footballerId = squad[idx] ?? null
              const footballer = footballerId ? footballers.find(f => f.id === footballerId) ?? null : null
              const isActive = activeSlot === idx

              return (
                <div
                  key={idx}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 cursor-pointer z-10"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  onClick={() => handleSlotClick(idx)}
                >
                  {footballer ? (
                    <div className="flex flex-col items-center gap-0.5">
                      {/* Slot size: 40px on mobile, 64px on sm+ */}
                      <div
                        className={`relative w-10 h-10 sm:w-16 sm:h-16 rounded-full ring-2 overflow-hidden bg-[#0A0F1A] transition-all ${rarityRing[footballer.rarity]} ${isActive ? '!ring-[#00E676] scale-110' : 'hover:scale-105'}`}
                      >
                        <PlayerPhoto footballer={footballer} />
                      </div>
                      <div className="text-[9px] sm:text-[11px] text-white/85 font-bold leading-none max-w-[3rem] sm:max-w-[4.5rem] text-center truncate drop-shadow">
                        {footballer.name.split(' ').slice(-1)[0]}
                      </div>
                      <div className="text-[9px] sm:text-[11px] font-oswald font-bold text-[#00E676] leading-none drop-shadow">
                        {playerOverall(boostedFootballer(footballer))}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`w-10 h-10 sm:w-16 sm:h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${emptyBorder[slot.pos]} ${isActive ? 'bg-white/20 scale-110' : 'bg-black/25 hover:bg-white/10 hover:scale-105'}`}
                    >
                      <span className="text-[8px] sm:text-xs font-oswald font-bold">{POS_UA[slot.pos]}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Formation legend */}
          <div className="flex justify-center gap-4 mt-3 text-[10px]">
            {(['GK','DEF','MID','FWD'] as Position[]).map(pos => {
              const colors = {
                GK:  'bg-yellow-400/20 text-yellow-300',
                DEF: 'bg-blue-400/20 text-blue-300',
                MID: 'bg-green-400/20 text-green-300',
                FWD: 'bg-red-400/20 text-red-300',
              }
              return (
                <div key={pos} className={`px-2 py-0.5 rounded font-oswald font-bold ${colors[pos]}`}>
                  {POS_UA[pos]}
                </div>
              )
            })}
          </div>
          {/* Chemistry lines legend */}
          {chemLinks.length > 0 && (
            <div className="flex justify-center gap-4 mt-2 text-[10px]">
              {chemLinks.some(l => l.type === 'club') && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0 border-t-2 border-dashed border-[#00E676]/60" />
                  <span className="text-[#5A7090] font-oswald">Клуб</span>
                </div>
              )}
              {chemLinks.some(l => l.type === 'nation') && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0 border-t-2 border-dashed border-[#FBBF24]/60" />
                  <span className="text-[#5A7090] font-oswald">Нація</span>
                </div>
              )}
              {chemLinks.some(l => l.type === 'both') && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0 border-t-2 border-dashed border-[#E879F9]/60" />
                  <span className="text-[#5A7090] font-oswald">Клуб + Нація</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel — desktop: right column; mobile: fixed bottom sheet when active */}
        <div className="w-full lg:w-1/2">

          {/* ── Active panels (stats / pick) ── */}
          {panelMode !== 'idle' && (
            <div
              className="
                fixed left-0 right-0 z-50
                sm:static sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto
                bg-[#0A0F1A] border border-b-0 sm:border-b border-[#1A2336]
                rounded-t-2xl sm:rounded-2xl
                overflow-hidden
              "
              style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
            >
              {/* Drag handle — mobile only */}
              <div className="sm:hidden flex justify-center pt-2.5 pb-1">
                <div className="w-8 h-1 bg-[#2A3A50] rounded-full" />
              </div>

              {/* Scrollable content area */}
              <div className="max-h-[52vh] sm:max-h-none overflow-y-auto">

                {/* Stats panel */}
                {panelMode === 'stats' && activePlayer && (
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs text-[#5A7090] uppercase tracking-wider">Гравець</div>
                      <button
                        onClick={closePanel}
                        className="w-8 h-8 flex items-center justify-center text-[#5A7090] hover:text-white hover:bg-[#1A2336] rounded-lg transition-colors text-xl cursor-pointer"
                      >×</button>
                    </div>
                    <div className="flex items-center gap-4 mb-5">
                      <div className={`w-16 h-16 rounded-full ring-2 overflow-hidden bg-black/40 shrink-0 ${rarityRing[activePlayer.rarity]}`}>
                        <PlayerPhoto footballer={activePlayer} />
                      </div>
                      <div>
                        <div className="font-oswald font-bold text-white text-lg leading-tight">{activePlayer.name}</div>
                        <div className="text-xs text-[#5A7090]">{activePlayer.club} · {activePlayer.nationality}</div>
                        <div className="font-oswald font-bold text-[#00E676] text-xl mt-1">{playerOverall(boostedFootballer(activePlayer))}</div>
                      </div>
                    </div>
                    {(() => {
                      const bs = boostedFootballer(activePlayer)
                      return (
                        <div className="space-y-2">
                          <StatBar label="Швидкість" value={bs.stats.pace} />
                          <StatBar label="Удар" value={bs.stats.shooting} />
                          <StatBar label="Пас" value={bs.stats.passing} />
                          <StatBar label="Дриблінг" value={bs.stats.dribbling} />
                        </div>
                      )
                    })()}
                    <button
                      onClick={handleRemoveFromStats}
                      className="mt-4 w-full py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-oswald font-bold uppercase tracking-wider hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      Видалити зі складу
                    </button>
                  </div>
                )}

                {/* Player picker */}
                {(panelMode === 'pick' || panelMode === 'stats') && activeSlot !== null && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs text-[#5A7090] uppercase tracking-wider">Вибери гравця</div>
                        <div className="font-oswald text-lg font-bold text-white">
                          {POS_UA[SLOTS[activeSlot].pos]}
                          <span className="text-[#5A7090] font-normal text-base ml-2">— позиція {activeSlot + 1}</span>
                        </div>
                      </div>
                      <button
                        onClick={closePanel}
                        className="w-8 h-8 flex items-center justify-center text-[#5A7090] hover:text-white hover:bg-[#1A2336] rounded-lg transition-colors text-xl cursor-pointer"
                      >×</button>
                    </div>

                    {pickerPlayers.length === 0 ? (
                      <div className="text-center py-8 text-[#5A7090]">
                        <div className="text-4xl mb-3">🔒</div>
                        <div className="font-oswald text-sm text-white">Немає карток на цю позицію</div>
                        <div className="text-xs mt-1">Купи пакети, щоб отримати гравців</div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {pickerPlayers.map(f => {
                          const inSquad = squad.includes(f.id)
                          const overall = playerOverall(f)
                          const chemDelta = !inSquad && activeSlot !== null
                            ? computeChemistryDelta(squad, activeSlot, f.id)
                            : 0
                          return (
                            <button
                              key={f.id}
                              disabled={inSquad}
                              onClick={() => handleSelectPlayer(f.id)}
                              className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-left ${
                                inSquad
                                  ? 'border-[#1A2336] opacity-35 cursor-not-allowed'
                                  : chemDelta > 0
                                    ? 'border-[#FBBF24]/40 bg-[#FBBF24]/5 hover:border-[#FBBF24]/70 hover:bg-[#FBBF24]/10 cursor-pointer active:scale-95'
                                    : 'border-[#1A2336] hover:border-[#00E676]/60 hover:bg-[#00E676]/5 cursor-pointer active:scale-95'
                              }`}
                            >
                              {chemDelta > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 bg-[#FBBF24] text-[#04060A] text-[9px] font-oswald font-bold px-1.5 py-0.5 rounded-full leading-none z-10">
                                  +{chemDelta}%
                                </div>
                              )}
                              <div className={`w-11 h-11 rounded-full overflow-hidden bg-black/40 ring-1 ${rarityRing[f.rarity]}`}>
                                <PlayerPhoto footballer={f} />
                              </div>
                              <div className="text-[10px] font-bold text-center leading-tight text-white/90 w-full truncate">
                                {f.name.split(' ').slice(-1)[0]}
                              </div>
                              <div className="text-xs text-center text-[#5A7090]">{f.club}</div>
                              <div className="text-xs text-center text-[#5A7090]">{f.nationality}</div>
                              <div className="text-[10px] font-oswald font-bold text-[#00E676]">{overall}</div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── Idle: squad summary ── always in normal flow */}
          {panelMode === 'idle' && (
            <div className="bg-[#0A0F1A] border border-[#1A2336] rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">⚽</div>
              <div className="font-oswald text-lg font-bold text-white mb-1">Вибери позицію</div>
              <div className="text-sm text-[#5A7090]">Натисни на порожній слот щоб додати гравця, або на гравця щоб побачити статистику</div>

              {filledPlayers.length > 0 && (
                <div className="mt-6 space-y-2 text-left">
                  <div className="text-xs text-[#5A7090] uppercase tracking-wider mb-3 font-oswald">Склад</div>
                  {SLOTS.map((slot, idx) => {
                    const id = squad[idx] ?? null
                    const f = id ? footballers.find(p => p.id === id) ?? null : null
                    if (!f) return null
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-[#0D1520] rounded-xl px-3 py-2">
                        <div className={`w-8 h-8 rounded-full ring-1 overflow-hidden bg-black/40 shrink-0 ${rarityRing[f.rarity]}`}>
                          <PlayerPhoto footballer={f} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{f.name}</div>
                          <div className="text-[10px] text-[#5A7090]">{f.club}</div>
                        </div>
                        <div className="font-oswald font-bold text-sm text-[#00E676]">{playerOverall(f)}</div>
                        <div className="text-[10px] font-bold text-[#5A7090] font-oswald">{POS_UA[slot.pos]}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Coach picker — bottom sheet on mobile, centered modal on desktop */}
      {coachPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-14 sm:pb-0">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCoachPickerOpen(false)}
          />
          {/* Panel */}
          <div className="relative w-full sm:max-w-2xl sm:mx-4 bg-[#0A0F1A] border border-[#FBBF24]/20 rounded-t-2xl sm:rounded-2xl overflow-hidden">
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="w-8 h-1 bg-[#2A3A50] rounded-full" />
            </div>
            <div className="max-h-[60vh] sm:max-h-[80vh] overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="font-oswald text-lg font-bold text-white">Вибери тренера</div>
                <button onClick={() => setCoachPickerOpen(false)} className="w-8 h-8 flex items-center justify-center text-[#5A7090] hover:text-white hover:bg-[#1A2336] rounded-lg text-xl cursor-pointer">×</button>
              </div>

              {assignedCoach && (
                <button
                  onClick={() => { assignCoach(null); setCoachPickerOpen(false) }}
                  className="w-full mb-3 py-2 border border-red-500/30 text-red-400 text-xs font-oswald font-bold uppercase tracking-wider hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                >
                  Зняти тренера
                </button>
              )}

              {(() => {
                const ownedCoaches = allCoaches.filter(c => (coachCollection[c.id] ?? 0) > 0)
                if (ownedCoaches.length === 0) {
                  return (
                    <div className="text-center py-8 text-[#5A7090]">
                      <div className="text-4xl mb-3">📋</div>
                      <div className="font-oswald text-sm text-white">Немає тренерів</div>
                      <div className="text-xs mt-1">Купи Тренерський Пакет у магазині</div>
                    </div>
                  )
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {ownedCoaches.map(c => {
                      const lvl = getCoachLevel(c.id, coachCollection)
                      const isActive = assignedCoach === c.id
                      return (
                        <button
                          key={c.id}
                          onClick={() => { assignCoach(c.id); setCoachPickerOpen(false) }}
                          className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isActive ? 'border-[#FBBF24]' : 'border-[#FBBF24]/20 hover:border-[#FBBF24]/50'}`}
                        >
                          <CoachCard coach={c} level={lvl} mini={false} showPerk />
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
