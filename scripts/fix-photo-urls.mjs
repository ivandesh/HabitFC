import { readFileSync, writeFileSync } from 'fs'

let content = readFileSync('src/data/footballers.ts', 'utf8')

// Each line with PLACEHOLDER has format: { id: 'PLAYERID', ... photoUrl: '/players/PLACEHOLDER.png' }
// Replace PLACEHOLDER with the actual player id from the same line
content = content.replace(/\{ id: '(\w+)',[^\n]*photoUrl: '\/players\/PLACEHOLDER\.png'/g, (match, id) => {
  return match.replace('/players/PLACEHOLDER.png', `/players/${id}.png`)
})

writeFileSync('src/data/footballers.ts', content)
console.log('Done')

// Verify
const updated = readFileSync('src/data/footballers.ts', 'utf8')
const remaining = (updated.match(/PLACEHOLDER/g) || []).length
console.log(`Remaining PLACEHOLDERs: ${remaining}`)
