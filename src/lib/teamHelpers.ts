import type { Team, AppState } from '../types'

export function getActiveTeam(state: Pick<AppState, 'teams' | 'activeTeamId'>): Team {
  return state.teams.find(t => t.id === state.activeTeamId) ?? state.teams[0]
}

export function createDefaultTeam(name = 'Команда 1'): Team {
  return {
    id: crypto.randomUUID(),
    name,
    squad: Array(11).fill(null),
    formation: '4-3-3',
    assignedCoach: null,
  }
}

export function migrateOldState(data: Record<string, unknown>): { teams: Team[]; activeTeamId: string } | null {
  if (Array.isArray(data.teams) && data.teams.length > 0) return null

  const squad = (data.squad as (string | null)[] | undefined) ?? Array(11).fill(null)
  const formation = (data.formation as string | undefined) ?? '4-3-3'
  const assignedCoach = (data.assignedCoach as string | null | undefined) ?? null

  const team: Team = {
    id: crypto.randomUUID(),
    name: 'Команда 1',
    squad,
    formation,
    assignedCoach,
  }

  return { teams: [team], activeTeamId: team.id }
}

export function findTeam(teams: Team[], teamId: string): Team | undefined {
  return teams.find(t => t.id === teamId)
}

export function updateTeamInArray(teams: Team[], teamId: string, patch: Partial<Team>): Team[] {
  return teams.map(t => t.id === teamId ? { ...t, ...patch } : t)
}
