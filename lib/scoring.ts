import { NflGame, NflTeam, GameResult, TeamWithPoints, UserStanding } from '@/types'

// ─── Per-game scoring ───────────────────────────────────────────────────────

export interface GamePointsInput {
  game: NflGame & { home_team: NflTeam; away_team: NflTeam }
  teamId: number
}

export function calculateGamePoints({
  game,
  teamId,
}: GamePointsInput): GameResult {
  const isHomeTeam = game.home_team_id === teamId
  const opponent = isHomeTeam ? game.away_team : game.home_team
  const teamScore = isHomeTeam ? game.home_score : game.away_score
  const opponentScore = isHomeTeam ? game.away_score : game.home_score

  let points = 0

  if (game.status === 'final' && teamScore !== null && opponentScore !== null) {
    if (teamScore > opponentScore) {
      // Win
      points = 1

      // Underdog bonus: team's spread >= 7 means they were a significant underdog
      if (game.home_spread !== null) {
        const teamSpread = isHomeTeam ? game.home_spread : -game.home_spread
        const isUnderdog = teamSpread >= 7

        if (isUnderdog) {
          // Regular season: +1 bonus (total 2); Playoffs: +2 bonus (total 3)
          points += game.is_playoff ? 2 : 1
        }
      }

      // Blowout bonus: win by more than 24 points
      if (teamScore - opponentScore > 24) {
        points += 1
      }
    } else if (teamScore === opponentScore) {
      // Tie — only possible in regular season
      points = -1
    }
    // Loss = 0 points
  }

  return {
    game,
    points,
    opponent,
    team_score: teamScore,
    opponent_score: opponentScore,
  }
}

// ─── Season standings ────────────────────────────────────────────────────────

export interface StandingsInput {
  users: Array<{
    id: string
    display_name: string
    email: string
  }>
  assignments: Array<{
    user_id: string
    team_id: number
    nfl_teams: NflTeam
  }>
  games: Array<NflGame & { home_team: NflTeam; away_team: NflTeam }>
}

export function calculateStandings({
  users,
  assignments,
  games,
}: StandingsInput): UserStanding[] {
  const standings: UserStanding[] = users.map((user) => {
    const userTeams = assignments.filter((a) => a.user_id === user.id)

    const teamsWithPoints: TeamWithPoints[] = userTeams.map((assignment) => {
      const team = assignment.nfl_teams
      const teamGames = games.filter(
        (g) => g.home_team_id === team.id || g.away_team_id === team.id
      )

      const gameResults = teamGames.map((game) =>
        calculateGamePoints({ game: game as any, teamId: team.id })
      )

      const teamPoints = gameResults.reduce((sum, r) => sum + r.points, 0)
      const wins = gameResults.filter(
        (r) => r.game.status === 'final' && r.team_score !== null && r.opponent_score !== null && r.team_score > r.opponent_score
      ).length
      const losses = gameResults.filter(
        (r) => r.game.status === 'final' && r.team_score !== null && r.opponent_score !== null && r.team_score < r.opponent_score
      ).length
      const ties = gameResults.filter(
        (r) => r.game.status === 'final' && r.team_score !== null && r.opponent_score !== null && r.team_score === r.opponent_score
      ).length

      return {
        team,
        points: teamPoints,
        wins,
        losses,
        ties,
        games: gameResults,
      }
    })

    const totalPoints = teamsWithPoints.reduce((sum, t) => sum + t.points, 0)
    const totalWins = teamsWithPoints.reduce((sum, t) => sum + t.wins, 0)
    const totalLosses = teamsWithPoints.reduce((sum, t) => sum + t.losses, 0)
    const totalTies = teamsWithPoints.reduce((sum, t) => sum + t.ties, 0)
    const totalUnderdogWins = teamsWithPoints.reduce((sum, t) => {
      const underdogWins = t.games.filter((g) => g.points >= 2).length
      return sum + underdogWins
    }, 0)

    const totalBlowoutWins = teamsWithPoints.reduce((sum, t) => {
      const blowouts = t.games.filter(
        (g) =>
          g.game.status === 'final' &&
          g.team_score !== null &&
          g.opponent_score !== null &&
          g.team_score - (g.opponent_score ?? 0) > 24
      ).length
      return sum + blowouts
    }, 0)

    return {
      user_id: user.id,
      display_name: user.display_name,
      total_points: totalPoints,
      wins: totalWins,
      losses: totalLosses,
      ties: totalTies,
      underdog_wins: totalUnderdogWins,
      blowout_wins: totalBlowoutWins,
      teams: teamsWithPoints,
    }
  })

  // Sort by total points descending
  return standings.sort((a, b) => b.total_points - a.total_points)
}
