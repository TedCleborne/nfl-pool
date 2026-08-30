// The Odds API helpers
// Sign up at https://the-odds-api.com — free tier = 500 requests/month
// NFL regular season has ~272 games, so sync spreads once per game day

const ODDS_BASE = 'https://api.the-odds-api.com/v4'

export interface GameOdds {
  id: string // The Odds API event ID (not the same as ESPN ID)
  homeTeam: string // Team name as returned by The Odds API
  awayTeam: string
  commenceTime: string
  homeSpread: number | null // negative = home favored (e.g. -3.5)
  awaySpread: number | null
}

// Fetch current NFL game spreads from The Odds API
export async function fetchNflSpreads(): Promise<GameOdds[]> {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) throw new Error('ODDS_API_KEY not set')

  const url = `${ODDS_BASE}/sports/americanfootball_nfl/odds/?apiKey=${apiKey}&regions=us&markets=spreads&oddsFormat=american`

  const res = await fetch(url, { cache: 'no-store' })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`The Odds API error ${res.status}: ${text}`)
  }

  const data = await res.json()

  return data.map((event: any) => {
    // Find a bookmaker — prefer DraftKings, fall back to first available
    const bookmaker =
      event.bookmakers?.find((b: any) => b.key === 'draftkings') ||
      event.bookmakers?.[0]

    const market = bookmaker?.markets?.find((m: any) => m.key === 'spreads')

    let homeSpread: number | null = null
    let awaySpread: number | null = null

    if (market) {
      const homeOutcome = market.outcomes.find(
        (o: any) => o.name === event.home_team
      )
      const awayOutcome = market.outcomes.find(
        (o: any) => o.name === event.away_team
      )
      homeSpread = homeOutcome?.point ?? null
      awaySpread = awayOutcome?.point ?? null
    }

    return {
      id: event.id,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      commenceTime: event.commence_time,
      homeSpread,
      awaySpread,
    }
  })
}

// Try to match an Odds API game to an ESPN game by team names + kickoff time
// Returns the spread for each team keyed by ESPN game ID
export function matchSpreadToGame(
  oddsGames: GameOdds[],
  espnHomeTeamName: string,
  espnAwayTeamName: string,
  kickoffTime: string
): { homeSpread: number | null } {
  // Match within 2-hour window (same game day, minor time mismatches)
  const kickoff = new Date(kickoffTime).getTime()

  for (const odds of oddsGames) {
    const oddsTime = new Date(odds.commenceTime).getTime()
    const timeDiff = Math.abs(kickoff - oddsTime)

    // Check team name similarity (partial match handles "New England Patriots" vs "Patriots")
    const homeMatch =
      odds.homeTeam.includes(espnHomeTeamName) ||
      espnHomeTeamName.includes(odds.homeTeam.split(' ').pop() || '')
    const awayMatch =
      odds.awayTeam.includes(espnAwayTeamName) ||
      espnAwayTeamName.includes(odds.awayTeam.split(' ').pop() || '')

    if (homeMatch && awayMatch && timeDiff < 2 * 60 * 60 * 1000) {
      return { homeSpread: odds.homeSpread }
    }
  }

  return { homeSpread: null }
}
