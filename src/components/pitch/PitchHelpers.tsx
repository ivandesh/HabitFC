import type { Position, Footballer } from '../../types'

export const POS_UA: Record<Position, string> = { GK: 'ВОР', DEF: 'ЗАХ', MID: 'ПЗА', FWD: 'НАП' }

export const rarityRing: Record<string, string> = {
  common:    'ring-gray-400/70',
  rare:      'ring-blue-400/80',
  epic:      'ring-pink-500/80',
  legendary: 'ring-yellow-400/90',
}

export const emptyBorder: Record<Position, string> = {
  GK:  'border-yellow-400/50 text-yellow-400/70',
  DEF: 'border-blue-400/50 text-blue-400/70',
  MID: 'border-green-400/50 text-green-400/70',
  FWD: 'border-red-400/50 text-red-400/70',
}

export function PlayerPhoto({ footballer }: { footballer: Footballer }) {
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

export function PitchSVG() {
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
