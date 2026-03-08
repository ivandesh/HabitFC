import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'

const OUT_DIR = 'public/players'

const players = [
  // 4 missing rare players (images exist but need photoUrl in data)
  // (images already downloaded, just listing for reference)

  // Common players - need download
  { id: 'mount',          search: 'Mason Mount' },
  { id: 'toney',          search: 'Ivan Toney' },
  { id: 'james',          search: 'Reece James' },
  { id: 'sterling',       search: 'Raheem Sterling' },
  { id: 'chilwell',       search: 'Ben Chilwell' },
  { id: 'cucurella',      search: 'Marc Cucurella' },
  { id: 'gallagher',      search: 'Conor Gallagher' },
  { id: 'madueke',        search: 'Noni Madueke' },
  { id: 'white',          search: 'Ben White' },
  { id: 'trossard',       search: 'Leandro Trossard' },
  { id: 'zinchenko',      search: 'Oleksandr Zinchenko' },
  { id: 'smith_rowe',     search: 'Emile Smith Rowe' },
  { id: 'nketiah',        search: 'Eddie Nketiah' },
  { id: 'partey',         search: 'Thomas Partey' },
  { id: 'kovacic',        search: 'Mateo Kovacic' },
  { id: 'doku',           search: 'Jeremy Doku' },
  { id: 'gvardiol',       search: 'Josko Gvardiol' },
  { id: 'ederson',        search: 'Ederson' },
  { id: 'walker',         search: 'Kyle Walker' },
  { id: 'alexander_arnold', search: 'Trent Alexander-Arnold' },
  { id: 'robertson',      search: 'Andrew Robertson' },
  { id: 'matip',          search: 'Joel Matip' },
  { id: 'gakpo',          search: 'Cody Gakpo' },
  { id: 'mac_allister',   search: 'Alexis Mac Allister' },
  { id: 'jones',          search: 'Curtis Jones' },
  { id: 'reijnders',      search: 'Tijjani Reijnders' },
  { id: 'leao',           search: 'Rafael Leao' },
  { id: 'giroud',         search: 'Olivier Giroud' },
  { id: 'tomori',         search: 'Fikayo Tomori' },
  { id: 'brozovic',       search: 'Marcelo Brozovic' },
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
  const res = await fetch(url)
  const json = await res.json()
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
  try {
    const thumbUrl = await searchPlayer(search)
    if (!thumbUrl) throw new Error('no thumb found')
    await downloadImage(thumbUrl, `${OUT_DIR}/${id}.png`)
    console.log(`✓ ${id}`)
    ok++
  } catch (e) {
    console.log(`✗ ${id} (${e.message})`)
    fail++
  }
  await new Promise(r => setTimeout(r, 150))
}

console.log(`\nDone: ${ok} downloaded, ${fail} failed`)
