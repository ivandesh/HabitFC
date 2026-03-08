/**
 * Download player headshots from TheSportsDB (free API, no key needed)
 * Uses strCutout (transparent PNG) when available, falls back to strThumb (JPG)
 * Run: node scripts/download-photos.mjs
 */
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../public/players')
const FOOTBALLERS_TS = path.join(__dirname, '../src/data/footballers.ts')

// Auto-parse player list from footballers.ts so we never go out of sync
function parsePlayersFromSource() {
  const src = fs.readFileSync(FOOTBALLERS_TS, 'utf8')
  const regex = /id:\s*'([^']+)',\s*name:\s*'([^']+)'/g
  const players = []
  let m
  while ((m = regex.exec(src)) !== null) {
    players.push({ id: m[1], name: m[2] })
  }
  return players
}

const PLAYERS = parsePlayersFromSource()

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
        catch (e) { reject(new Error('JSON parse error')) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    const req = proto.get(url, { headers: { 'User-Agent': 'HabitFC/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close(); fs.unlinkSync(dest)
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(dest) } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', err => { try { fs.unlinkSync(dest) } catch {}; reject(err) })
    })
    req.on('error', err => { try { fs.unlinkSync(dest) } catch {}; reject(err) })
  })
}

async function fetchPlayerImages(searchName, retries = 2) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(searchName)}`
  try {
    const data = await getJson(url)
    const players = data?.player ?? []
    if (!players.length) return null
    // Take first soccer result
    const player = players.find(p => p.strSport === 'Soccer') ?? players[0]
    return {
      cutout: player.strCutout || null,  // transparent PNG – preferred
      thumb:  player.strThumb  || null,  // JPEG fallback
    }
  } catch (err) {
    if (retries > 0 && err.message === 'JSON parse error') {
      console.log(`    ↻ rate limited, waiting 5s then retrying...`)
      await sleep(5000)
      return fetchPlayerImages(searchName, retries - 1)
    }
    throw err
  }
}

async function main() {
  // Ensure output dir exists (does NOT delete existing images so re-runs skip already downloaded)
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const results = { png: 0, jpg: 0, missing: 0, error: 0 }
  // Track which extension each player ended up with (for patching footballers.ts)
  const extMap = {}

  const BATCH_SIZE = 20
  const BATCH_PAUSE = 90 * 1000 // 1.5 minutes (API limit: 30 req/min)

  for (let i = 0; i < PLAYERS.length; i++) {
    // Pause between batches
    if (i > 0 && i % BATCH_SIZE === 0) {
      console.log(`\n⏸  Batch done. Pausing 5 minutes to avoid rate limit... (resuming at ${new Date(Date.now() + BATCH_PAUSE).toLocaleTimeString()})\n`)
      await sleep(BATCH_PAUSE)
    }

    const { id, name } = PLAYERS[i]
    const label = `[${String(i + 1).padStart(3)}/${PLAYERS.length}] ${id}`

    // Skip if already downloaded
    const existingPng = path.join(OUTPUT_DIR, `${id}.png`)
    const existingJpg = path.join(OUTPUT_DIR, `${id}.jpg`)
    if (fs.existsSync(existingPng)) { extMap[id] = 'png'; console.log(`${label} — ⏭ already exists`); continue }
    if (fs.existsSync(existingJpg)) { extMap[id] = 'jpg'; console.log(`${label} — ⏭ already exists`); continue }

    if (!name) {
      console.log(`${label} — skipped`)
      results.missing++
      continue
    }

    try {
      const imgs = await fetchPlayerImages(name)

      if (!imgs || (!imgs.cutout && !imgs.thumb)) {
        console.log(`${label} — ✗ not found on TheSportsDB`)
        results.missing++
      } else if (imgs.cutout) {
        const dest = path.join(OUTPUT_DIR, `${id}.png`)
        await downloadFile(imgs.cutout, dest)
        const kb = Math.round(fs.statSync(dest).size / 1024)
        console.log(`${label} — ✓ cutout.png (${kb}kb)`)
        extMap[id] = 'png'
        results.png++
      } else {
        const dest = path.join(OUTPUT_DIR, `${id}.jpg`)
        await downloadFile(imgs.thumb, dest)
        const kb = Math.round(fs.statSync(dest).size / 1024)
        console.log(`${label} — ✓ thumb.jpg (${kb}kb)`)
        extMap[id] = 'jpg'
        results.jpg++
      }
    } catch (err) {
      console.log(`${label} — ✗ error: ${err.message}`)
      results.error++
    }

    if ((i + 1) % BATCH_SIZE !== 0) await sleep(3000)
  }

  // Patch footballers.ts photoUrls with correct extensions
  console.log('\nPatching src/data/footballers.ts...')
  let ts = fs.readFileSync(FOOTBALLERS_TS, 'utf8')
  for (const [id, ext] of Object.entries(extMap)) {
    // Replace both .jpg and .png to the correct ext for this player
    const escaped = id.replace(/_/g, '_') // no special chars
    ts = ts.replace(
      new RegExp(`(photoUrl: '/players/${escaped})\\.(jpg|png)'`, 'g'),
      `$1.${ext}'`
    )
  }
  fs.writeFileSync(FOOTBALLERS_TS, ts)

  console.log(`\n─────────────────────────────────────────`)
  console.log(`Cutout PNGs : ${results.png}`)
  console.log(`Thumb JPGs  : ${results.jpg}`)
  console.log(`Missing     : ${results.missing}`)
  console.log(`Errors      : ${results.error}`)
  console.log(`Images saved to: ${OUTPUT_DIR}`)
}

main().catch(console.error)
