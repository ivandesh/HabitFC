const WATCHED_KEY = 'habitfc_watched_matches'

export function getWatchedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(WATCHED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

export function markWatched(matchId: string) {
  const set = getWatchedSet()
  set.add(matchId)
  localStorage.setItem(WATCHED_KEY, JSON.stringify([...set]))
}
