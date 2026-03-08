import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

const OUT_DIR = 'src/assets/players'

// Players that failed from futbin, with TheSportsDB search terms + club hint to pick right result
const missing = [
  { id: 'yamal',       search: 'Lamine Yamal',       club: 'Barcelona' },
  { id: 'pedri',       search: 'Pedri',               club: 'Barcelona' },
  { id: 'osimhen',     search: 'Victor Osimhen',      club: null },
  { id: 'jota',        search: 'Diogo Jota',          club: 'Liverpool' },
  { id: 'rubendias',   search: 'Ruben Dias',          club: 'Manchester City' },
  { id: 'caicedo',     search: 'Moises Caicedo',      club: 'Chelsea' },
  { id: 'carvajal',    search: 'Dani Carvajal',       club: 'Real Madrid' },
  { id: 'rashford',    search: 'Marcus Rashford',     club: null },
  { id: 'martinelli',  search: 'Gabriel Martinelli',  club: 'Arsenal' },
  { id: 'rice',        search: 'Declan Rice',         club: 'Arsenal' },
  { id: 'gabriel',     search: 'Gabriel Magalhaes',   club: 'Arsenal' },
  { id: 'havertz',     search: 'Kai Havertz',         club: 'Arsenal' },
  { id: 'diaz',        search: 'Luis Diaz',           club: 'Liverpool' },
  { id: 'nunez',       search: 'Darwin Nunez',        club: 'Liverpool' },
  { id: 'szoboszlai',  search: 'Dominik Szoboszlai',  club: 'Liverpool' },
  { id: 'lookman',     search: 'Ademola Lookman',     club: null },
  { id: 'chiesa',      search: 'Federico Chiesa',     club: 'Liverpool' },
  { id: 'ruiz',        search: 'Fabian Ruiz',         club: null },
  { id: 'dimarco',     search: 'Federico Dimarco',    club: 'Inter' },
  { id: 'lautaro',     search: 'Lautaro Martinez',    club: 'Inter' },
  { id: 'kvara',       search: 'Khvicha Kvaratskhelia',club: null },
  { id: 'maignan',     search: 'Mike Maignan',        club: 'AC Milan' },
  { id: 'hernandez',   search: 'Theo Hernandez',      club: 'AC Milan' },
  { id: 'calhanoglu',  search: 'Hakan Calhanoglu',    club: 'Inter' },
  { id: 'isak',        search: 'Alexander Isak',      club: 'Newcastle' },
  { id: 'gnonto',      search: 'Wilfried Gnonto',     club: null },
  { id: 'savinho',     search: 'Savinho',             club: 'Manchester City' },
  { id: 'gudmundsson', search: 'Johann Gudmundsson',  club: null },
]

async function searchPlayer(search, clubHint) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(search)}`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.player?.length) return null

  // If club hint, prefer matching club
  if (clubHint) {
    const match = json.player.find(p =>
      p.strTeam?.toLowerCase().includes(clubHint.toLowerCase()) ||
      p.strSport === 'Soccer'
    )
    if (match?.strThumb) return match.strThumb
  }

  // Just take first soccer player with a thumb
  const first = json.player.find(p => p.strThumb && p.strSport === 'Soccer')
  return first?.strThumb ?? json.player[0]?.strThumb ?? null
}

async function downloadImage(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

let ok = 0, fail = 0

for (const { id, search, club } of missing) {
  try {
    const thumbUrl = await searchPlayer(search, club)
    if (!thumbUrl) throw new Error('no thumb found')
    await downloadImage(thumbUrl, `${OUT_DIR}/${id}.png`)
    console.log(`✓ ${id} — ${thumbUrl}`)
    ok++
  } catch (e) {
    console.log(`✗ ${id} (${e.message})`)
    fail++
  }
  // Small delay to be polite to the API
  await new Promise(r => setTimeout(r, 200))
}

console.log(`\nDone: ${ok} downloaded, ${fail} failed`)
