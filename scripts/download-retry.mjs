import { createWriteStream, existsSync } from 'fs'
import { pipeline } from 'stream/promises'

const OUT_DIR = 'public/players'

const players = [
  { id: 'smith_rowe',     search: 'Smith Rowe' },
  { id: 'dumfries',       search: 'Denzel Dumfries' },
  { id: 'thuram',         search: 'Marcus Thuram' },
  { id: 'barella',        search: 'Nicolo Barella' },
  { id: 'mkhitaryan',     search: 'Henrikh Mkhitaryan' },
  { id: 'darmian',        search: 'Matteo Darmian' },
  { id: 'goretzka',       search: 'Leon Goretzka' },
  { id: 'gnabry',         search: 'Serge Gnabry' },
  { id: 'sane',           search: 'Leroy Sane' },
  { id: 'coman',          search: 'Kingsley Coman' },
  { id: 'upamecano',      search: 'Dayot Upamecano' },
  { id: 'muller',         search: 'Thomas Muller' },
  { id: 'laporte',        search: 'Aymeric Laporte' },
  { id: 'sabitzer',       search: 'Marcel Sabitzer' },
  { id: 'brandt',         search: 'Julian Brandt' },
  { id: 'sancho',         search: 'Jadon Sancho' },
  { id: 'reus',           search: 'Marco Reus' },
  { id: 'hummels',        search: 'Mats Hummels' },
  { id: 'fullkrug',       search: 'Niclas Fullkrug' },
  { id: 'adeyemi',        search: 'Karim Adeyemi' },
  { id: 'bynoe_gittens',  search: 'Jamie Bynoe-Gittens' },
  { id: 'dembele_spurs',  search: 'Ange Dembele' },
  { id: 'kulusevski',     search: 'Dejan Kulusevski' },
  { id: 'maddison',       search: 'James Maddison' },
  { id: 'bentancur',      search: 'Rodrigo Bentancur' },
  { id: 'sarr',           search: 'Pape Sarr' },
  { id: 'gray',           search: 'Demarai Gray' },
  { id: 'gordon',         search: 'Anthony Gordon' },
  { id: 'murphy',         search: 'Jacob Murphy' },
  { id: 'botman',         search: 'Sven Botman' },
  { id: 'targett',        search: 'Matt Targett' },
  { id: 'burn',           search: 'Dan Burn' },
]

async function searchPlayer(search) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(search)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const text = await res.text()
  if (text.trim().startsWith('<')) throw new Error('rate limited (HTML response)')
  const json = JSON.parse(text)
  if (!json.player?.length) return null
  const first = json.player.find(p => p.strThumb && p.strSport === 'Soccer')
  return first?.strThumb ?? null
}

async function downloadImage(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

let ok = 0, fail = 0

for (const { id, search } of players) {
  if (existsSync(`${OUT_DIR}/${id}.png`)) {
    console.log(`⏭ ${id} (already exists)`)
    ok++
    continue
  }
  let success = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const thumbUrl = await searchPlayer(search)
      if (!thumbUrl) throw new Error('no thumb found')
      await downloadImage(thumbUrl, `${OUT_DIR}/${id}.png`)
      console.log(`✓ ${id}`)
      ok++
      success = true
      break
    } catch (e) {
      if (attempt < 3 && e.message.includes('rate limited')) {
        console.log(`  ⏳ rate limited, waiting 5s (attempt ${attempt})...`)
        await new Promise(r => setTimeout(r, 5000))
      } else if (attempt === 3) {
        console.log(`✗ ${id} (${e.message})`)
        fail++
      }
    }
  }
  // 600ms between each player to stay under rate limit
  await new Promise(r => setTimeout(r, 600))
}

console.log(`\nDone: ${ok} downloaded, ${fail} failed`)
