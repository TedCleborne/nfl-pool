import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'
import { calculateStandings } from '@/lib/scoring'
import StandingsTable from '@/components/StandingsTable'
import WeeklyScores from '@/components/WeeklyScores'

export const revalidate = 60 // revalidate every 60 seconds

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  // ─── Fetch all data ─────────────────────────────────────────
  const [
    { data: users },
    { data: assignments },
    { data: games },
    { data: dpWeeks },
  ] = await Promise.all([
    supabase.from('league_users').select('id, display_name, email').order('display_name'),
    supabase.from('team_assignments').select(`
      user_id, team_id, draft_pick,
      nfl_teams(id, name, abbreviation, city, full_name, conference, division, logo_url, primary_color)
    `),
    supabase.from('nfl_games').select(`
      id, season, week, season_type, is_playoff, playoff_round,
      home_team_id, away_team_id, home_score, away_score,
      status, kickoff_time, home_spread, spread_locked,
      home_team:nfl_teams!nfl_games_home_team_id_fkey(id, name, abbreviation, city, full_name, conference, division, logo_url, primary_color),
      away_team:nfl_teams!nfl_games_away_team_id_fkey(id, name, abbreviation, city, full_name, conference, division, logo_url, primary_color)
    `).order('kickoff_time'),
    supabase.from('double_points_weeks').select('user_id, team_id, week, season, locked'),
  ])

  // ─── Current week ────────────────────────────────────────────
  const finalGames = (games || []).filter((g) => g.status === 'final')
  const currentWeek = games && games.length > 0
    ? Math.max(...games.map((g) => g.is_playoff ? 0 : g.week).filter(w => w > 0))
    : 1
  const currentSeason = games && games.length > 0 ? games[0].season : 2026

  // Games for the current/most recent active week
  const weekGames = (games || []).filter(
    (g) => g.week === currentWeek && g.season === currentSeason && !g.is_playoff
  )

  // ─── Standings ───────────────────────────────────────────────
  const standings = (users && assignments && games)
    ? calculateStandings({
        users: users as any,
        assignments: assignments as any,
        games: games as any,
        doublePointsWeeks: dpWeeks || [],
      })
    : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">2026 NFL Pool</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Season standings · Week {currentWeek}
        </p>
      </div>

      {/* Standings */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Standings</h2>
        <StandingsTable standings={standings} />
      </section>

      {/* This week's scores */}
      {weekGames.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Week {currentWeek} Scores
          </h2>
          <WeeklyScores games={weekGames as any} assignments={assignments as any} />
        </section>
      )}
    </div>
  )
}
