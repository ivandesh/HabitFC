import https from 'https'
import http from 'http'
import { writeFileSync, mkdirSync, existsSync, unlinkSync, createWriteStream, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/coaches')
mkdirSync(OUT_DIR, { recursive: true })

const coaches = [
  { id: 'guardiola',   query: 'Pep Guardiola' },
  { id: 'klopp',       query: 'Jurgen Klopp' },
  { id: 'ancelotti',   query: 'Carlo Ancelotti' },
  { id: 'ferguson',    query: 'Alex Ferguson' },
  { id: 'mourinho',    query: 'Jose Mourinho' },
  { id: 'simeone',     query: 'Diego Simeone' },
  { id: 'conte',       query: 'Antonio Conte' },
  { id: 'tuchel',      query: 'Thomas Tuchel' },
  { id: 'zidane',      query: 'Zinedine Zidane' },
  { id: 'luisenrique', query: 'Luis Enrique' },
  { id: 'xavi',        query: 'Xavi Hernandez' },
  { id: 'arteta',      query: 'Mikel Arteta' },
  { id: 'wenger',      query: 'Arsene Wenger' },
  { id: 'flick',       query: 'Hansi Flick' },
  { id: 'emery',       query: 'Unai Emery' },
  { id: 'pochettino',  query: 'Mauricio Pochettino' },
  { id: 'allegri',     query: 'Massimiliano Allegri' },
  { id: 'inzaghi',     query: 'Simone Inzaghi' },
  { id: 'deschamps',   query: 'Didier Deschamps' },
  { id: 'southgate',   query: 'Gareth Southgate' },
  { id: 'tenhag',      query: 'Erik ten Hag' },
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    proto.get(url, { headers: { 'User-Agent': 'HabitFC/1.0' } }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 80))) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = createWriteStream(dest)
    proto.get(url, { headers: { 'User-Agent': 'HabitFC/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); try { unlinkSync(dest) } catch {}
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close(); try { unlinkSync(dest) } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', err => { try { unlinkSync(dest) } catch {}; reject(err) })
    }).on('error', err => { try { unlinkSync(dest) } catch {}; reject(err) })
  })
}

for (const { id, query } of coaches) {
  const destPng = join(OUT_DIR, `${id}.png`)
  const destJpg = join(OUT_DIR, `${id}.jpg`)
  if (existsSync(destPng) || existsSync(destJpg)) {
    console.log(`⏭  ${id} — already exists`)
    continue
  }

  try {
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(query)}`
    const data = await getJson(url)
    const results = data.player ?? []
    const person = results.find(p => p.strPosition === 'Manager' || p.strSport === 'Soccer') ?? results[0]
    const thumbUrl = person?.strCutout || person?.strThumb || person?.strRender
    if (!thumbUrl) {
      console.warn(`✗ ${id} — no photo found`)
    } else {
      const isImg = /\.(png|jpg|jpeg|webp)/i.test(thumbUrl)
      const dest = isImg && thumbUrl.toLowerCase().includes('.png') ? destPng : destJpg
      await downloadFile(thumbUrl, dest)
      const kb = Math.round(statSync(dest).size / 1024)
      console.log(`✓ ${id} (${kb}kb)`)
    }
  } catch (e) {
    console.error(`✗ ${id}: ${e.message}`)
  }

  await sleep(2000)
}

console.log('\nDone. Photos saved to public/coaches/')
