import { NflGame, NflTeam, GameResult, TeamWithPoints, UserStanding } from '@/types'

// ─── Per-game scoring ───────────────────────────────────────────────────────

export interface GamePointsInput {
  game: NflGame & { home_team: NflTeam; away_team: NflTeam }
  teamId: number
  isDoublePointsWeek: boolean
}

export function calculateGamePoints({
  game,
  teamId,
  isDoublePointsWeek,
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

      // Underdog bonus: team's spread > 3.5 means they were the underdog
      if (game.home_spread !== null) {
        // home_spread is from home team's perspective (negative = home favored)
        const teamSpread = isHomeTeam ? game.home_spread : -game.home_spread
        const isUnderdog = teamSpread > 3.5

        if (isUnderdog) {
          // Regular season: +1 bonus (total 2); Playoffs: +2 bonus (total 3)
          points += game.is_playoff ? 2 : 1
        }
      }
    } else if (teamScore === opponentScore) {
      // Tie — only possible in regular season (no OT ties in playoffs)
      points = -1
    }
    // Loss = 0 points

    // Double points: applies to regular season games only, multiplies all points
    if (isDoublePointsWeek && !game.is_playoff) {
      points *= 2
    }
  }

  return {
    game,
    points,
    is_double_points_week: isDoublePointsWeek && !game.is_playoff,
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
  doublePointsWeeks: Array<{
    user_id: string
    team_id: number
    week: number
    season: number
  }>
}

export function calculateStandings({
  users,
  assignments,
  games,
  doublePointsWeeks,
}: StandingsInput): UserStanding[] {
  const standings: UserStanding[] = users.map((user) => {
    const userTeams = assignments.filter((a) => a.user_id === user.id)

    const teamsWithPoints: TeamWithPoints[] = userTeams.map((assignment) => {
      const team = assignment.nfl_teams
      const teamGames = games.filter(
        (g) =>
          g.home_team_id === team.id || g.away_team_id === team.id
      )

      const dpw = doublePointsWeeks.find(
        (d) => d.user_id === user.id && d.team_id === team.id
      )

      const gameResults = teamGames.map((game) => {
        const isDoublePointsWeek =
          dpw !== undefined &&
          game.week === dpw.week &&
          game.season === dpw.season &&
          !game.is_playoff

        return calculateGamePoints({
          game: game as any,
          teamId: team.id,
          isDoublePointsWeek,
        })
      })

      const teamPoints = gameResults.reduce((sum, r) => sum + r.points, 0)
const wins = gameResults.filter(
  (r) => r.game.status === 'final' && r.team_score !== null && r.opponent_score !== null &&
    r.team_score > r.opponent_score
).length
const losses = gameResults.filter(
  (r) => r.game.status === 'final' && r.team_score !== null && r.opponent_score !== null &&
    r.team_score < r.opponent_score
).length
const ties = gameResults.filter(
  (r) => r.game.status === 'final' && r.team_score !== null && r.opponent_score !== null &&
    r.team_score === r.opponent_score
).length

      return {
        team,
        points: teamPoints,
        wins,
        losses,
        ties,
        double_points_week: dpw?.week ?? null,
        games: gameResults,
      }
    })

    const totalPoints = teamsWithPoints.reduce((sum, t) => sum + t.points, 0)
    const totalWins = teamsWithPoints.reduce((sum, t) => sum + t.wins, 0)
    const totalLosses = teamsWithPoints.reduce((sum, t) => sum + t.losses, 0)
    const totalTies = teamsWithPoints.reduce((sum, t) => sum + t.ties, 0)
    const totalUnderdogWins = teamsWithPoints.reduce((sum, t) => {
      const underdogWins = t.games.filter((g) => {
        const basePoints = g.is_double_points_week
          ? g.points / 2
          : g.points
        return basePoints >= 2
      }).length
      return sum + underdogWins
    }, 0)

    return {
      user_id: user.id,
      display_name: user.display_name,
      total_points: totalPoints,
      wins: totalWins,
      losses: totalLosses,
      ties: totalTies,
      underdog_wins: totalUnderdogWins,
      teams: teamsWithPoints,
    }
  })

  // Sort by total points descending
  return standings.sort((a, b) => b.total_points - a.total_points)
}
