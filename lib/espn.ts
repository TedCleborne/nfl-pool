// ESPN unofficial API helpers
// No API key required — public endpoints

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

export interface EspnGame {
  id: string
  week: number
  season: number
  isPlayoff: boolean
  playoffRound?: string
  homeTeamEspnId: string
  awayTeamEspnId: string
  homeScore: number | null
  awayScore: number | null
  status: 'scheduled' | 'in_progress' | 'final'
  kickoffTime: string
}

export interface EspnTeam {
  id: string
  name: string
  abbreviation: string
  city: string
  fullName: string
  conference: string
  division: string
  logoUrl: string
  primaryColor: string
}

// Fetch all 32 NFL teams
export async function fetchAllTeams(): Promise<EspnTeam[]> {
  const res = await fetch(`${ESPN_BASE}/teams?limit=32`, { next: { revalidate: 86400 } })
  const data = await res.json()

  return data.sports[0].leagues[0].teams.map((t: any) => {
    const team = t.team
    return {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      city: team.location,
      fullName: team.displayName,
      conference: team.groups?.parent?.abbreviation || '',
      division: team.groups?.abbreviation || '',
      logoUrl: team.logos?.[0]?.href || '',
      primaryColor: team.color ? `#${team.color}` : '#013369',
    }
  })
}

// Fetch scoreboard for a specific week
// seasontype: 2 = regular season, 3 = postseason
export async function fetchWeekScoreboard(
  season: number,
  week: number,
  seasonType: 2 | 3 = 2
): Promise<EspnGame[]> {
  const url = `${ESPN_BASE}/scoreboard?dates=${season}&seasontype=${seasonType}&week=${week}`
  const res = await fetch(url, { next: { revalidate: 60 } }) // revalidate every 60s
  const data = await res.json()

  if (!data.events) return []

  return data.events.map((event: any) => {
    const competition = event.competitions[0]
    const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home')
    const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away')

    const statusType = competition.status?.type?.name
    let status: 'scheduled' | 'in_progress' | 'final' = 'scheduled'
    if (statusType === 'STATUS_FINAL') status = 'final'
    else if (statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME') status = 'in_progress'

    const isPlayoff = seasonType === 3
    let playoffRound: string | undefined
    if (isPlayoff) {
      if (week === 1) playoffRound = 'wildcard'
      else if (week === 2) playoffRound = 'divisional'
      else if (week === 3) playoffRound = 'championship'
      else if (week === 4) playoffRound = 'superbowl'
    }

    return {
      id: event.id,
      week,
      season,
      isPlayoff,
      playoffRound,
      homeTeamEspnId: homeTeam?.team?.id,
      awayTeamEspnId: awayTeam?.team?.id,
      homeScore: homeTeam?.score ? parseInt(homeTeam.score) : null,
      awayScore: awayTeam?.score ? parseInt(awayTeam.score) : null,
      status,
      kickoffTime: event.date,
    }
  })
}

// Fetch the current week number and season type from ESPN
export async function fetchCurrentWeek(): Promise<{
  season: number
  week: number
  seasonType: 2 | 3
}> {
  const res = await fetch(`${ESPN_BASE}/scoreboard`, { next: { revalidate: 300 } })
  const data = await res.json()

  const season = data.season?.year || new Date().getFullYear()
  const week = data.week?.number || 1
  const seasonType = data.season?.type === 3 ? 3 : 2

  return { season, week, seasonType }
}
