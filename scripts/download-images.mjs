import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { pipeline } from 'stream/promises'

const BASE_URL = 'https://cdn.futbin.com/content/fifa25/img/players'
const OUT_DIR = 'src/assets/players'

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const players = [
  // Legendary
  { id: 'messi',      eaId: 158023 },
  { id: 'ronaldo',    eaId: 20801 },
  { id: 'mbappe',     eaId: 231747 },
  { id: 'haaland',    eaId: 239085 },
  { id: 'vinicius',   eaId: 238794 },
  { id: 'yamal',      eaId: 261777 },
  { id: 'bellingham', eaId: 251413 },
  { id: 'pedri',      eaId: 261485 },
  // Epic
  { id: 'debruyne',   eaId: 192985 },
  { id: 'salah',      eaId: 209331 },
  { id: 'modric',     eaId: 177003 },
  { id: 'lewandowski',eaId: 188545 },
  { id: 'neymar',     eaId: 190871 },
  { id: 'saka',       eaId: 246669 },
  { id: 'camavinga',  eaId: 261153 },
  { id: 'wirtz',      eaId: 260535 },
  { id: 'osimhen',    eaId: 237847 },
  { id: 'jota',       eaId: 213564 },
  { id: 'griezmann',  eaId: 194765 },
  { id: 'son',        eaId: 202126 },
  { id: 'bernardo',   eaId: 218667 },
  { id: 'alisson',    eaId: 211110 },
  { id: 'terstegen',  eaId: 192448 },
  { id: 'rubendias',  eaId: 239477 },
  { id: 'vandijk',    eaId: 203376 },
  { id: 'kimmich',    eaId: 212622 },
  { id: 'kroos',      eaId: 182521 },
  { id: 'caicedo',    eaId: 260698 },
  { id: 'rodri',      eaId: 231866 },
  { id: 'carvajal',   eaId: 176635 },
  // Rare
  { id: 'rashford',   eaId: 217144 },
  { id: 'martinelli', eaId: 261023 },
  { id: 'rice',       eaId: 245580 },
  { id: 'dembele',    eaId: 231443 },
  { id: 'foden',      eaId: 237692 },
  { id: 'gabriel',    eaId: 212176 },
  { id: 'musiala',    eaId: 263585 },
  { id: 'gavi',       eaId: 262954 },
  { id: 'havertz',    eaId: 234862 },
  { id: 'diaz',       eaId: 249189 },
  { id: 'nunez',      eaId: 253843 },
  { id: 'odegaard',   eaId: 228702 },
  { id: 'szoboszlai', eaId: 249609 },
  { id: 'trippier',   eaId: 198011 },
  { id: 'lookman',    eaId: 243070 },
  { id: 'chiesa',     eaId: 225029 },
  { id: 'ruiz',       eaId: 218009 },
  { id: 'dimarco',    eaId: 222965 },
  { id: 'lautaro',    eaId: 237837 },
  { id: 'kvara',      eaId: 258719 },
  { id: 'maignan',    eaId: 219325 },
  { id: 'hernandez',  eaId: 244648 },
  { id: 'calhanoglu', eaId: 213877 },
  { id: 'pulisic',    eaId: 230666 },
  { id: 'guimaraes',  eaId: 244305 },
  { id: 'isak',       eaId: 236697 },
  { id: 'gnonto',     eaId: 260946 },
  { id: 'savinho',    eaId: 266156 },
  { id: 'timber',     eaId: 261004 },
  { id: 'gudmundsson',eaId: 213566 },
]

let ok = 0, fail = 0

for (const { id, eaId } of players) {
  const url = `${BASE_URL}/${eaId}.png`
  const dest = `${OUT_DIR}/${id}.png`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await pipeline(res.body, createWriteStream(dest))
    console.log(`✓ ${id}`)
    ok++
  } catch (e) {
    console.log(`✗ ${id} (${e.message})`)
    fail++
  }
}

console.log(`\nDone: ${ok} downloaded, ${fail} failed`)
