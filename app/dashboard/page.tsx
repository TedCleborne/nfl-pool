import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'
import { calculateStandings } from '@/lib/scoring'
import StandingsTable from '@/components/StandingsTable'
import WeeklyScores from '@/components/WeeklyScores'

export const revalidate = 60 // revalidate every 60 seconds

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  // ─── Get logged-in user ──────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  // ─── Fetch all data ─────────────────────────────────────────
  const [
    { data: users },
    { data: assignments },
    { data: games },
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
  ])

  // ─── Current week ────────────────────────────────────────────
  const currentSeason = games && games.length > 0 ? games[0].season : 2026

  const scheduledOrLive = (games || []).filter(
    (g) => !g.is_playoff && (g.status === 'scheduled' || g.status === 'in_progress')
  )
  const currentWeek = scheduledOrLive.length > 0
    ? Math.min(...scheduledOrLive.map((g) => g.week))
    : games && games.length > 0
      ? Math.max(...(games || []).filter((g) => !g.is_playoff).map((g) => g.week))
      : 1

  // ─── Standings ───────────────────────────────────────────────
  const standings = (users && assignments && games)
    ? calculateStandings({
        users: users as any,
        assignments: assignments as any,
        games: games as any,
      })
    : []

  // ─── My team IDs (for WeeklyScores highlighting) ────────────
  const myTeamIds = user
    ? (assignments || []).filter((a) => a.user_id === user.id).map((a) => a.team_id)
    : []

  // All non-playoff games for the week navigator
  const allRegularGames = (games || []).filter((g) => !g.is_playoff)

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

      {/* Weekly scores with navigation */}
      {allRegularGames.length > 0 && (
        <section>
          <WeeklyScores
            games={allRegularGames as any}
            myTeamIds={myTeamIds}
            currentWeek={currentWeek}
          />
        </section>
      )}
    </div>
  )
}
