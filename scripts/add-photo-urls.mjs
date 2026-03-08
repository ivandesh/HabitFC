import { readFileSync, writeFileSync, existsSync } from 'fs'

let content = readFileSync('src/data/footballers.ts', 'utf8')

// For every footballer entry that lacks a photoUrl, add one if the image exists
// Match lines like: { id: 'PLAYERID', ... emoji: '...', }  (no photoUrl)
content = content.replace(
  /(\{ id: '(\w+)',[^\n]*emoji: '[^']*')( \})/g,
  (match, before, id, closing) => {
    if (match.includes('photoUrl')) return match // already has it
    if (existsSync(`public/players/${id}.png`)) {
      return `${before}, photoUrl: '/players/${id}.png'${closing}`
    }
    return match
  }
)

writeFileSync('src/data/footballers.ts', content)

// Count how many now have photoUrl
const updated = readFileSync('src/data/footballers.ts', 'utf8')
const count = (updated.match(/photoUrl/g) || []).length
const total = (updated.match(/\{ id: '/g) || []).length
console.log(`photoUrl set on ${count}/${total} players`)
