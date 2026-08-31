import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import { calculateStandings } from '@/lib/scoring'
import StandingsTable from '@/components/StandingsTable'
import WeeklyScores from '@/components/WeeklyScores'
import Navbar from '@/components/Navbar'

export const revalidate = 60

export default async function DashboardPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leagueUser } = await supabase
    .from('league_users')
    .select('id, display_name, email')
    .eq('id', user.id)
    .single()

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

  const currentWeek = games && games.length > 0
    ? Math.max(...games.map((g) => g.is_playoff ? 0 : g.week).filter(w => w > 0))
    : 1
  const currentSeason = games && games.length > 0 ? games[0].season : 2026

  const weekGames = (games || []).filter(
    (g) => g.week === currentWeek && g.season === currentSeason && !g.is_playoff
  )

  const standings = (users && assignments && games)
    ? calculateStandings({
        users: users as any,
        assignments: assignments as any,
        games: games as any,
        doublePointsWeeks: dpWeeks || [],
      })
    : []

  // My team IDs only
  const myTeamIds = (assignments || [])
    .filter((a) => a.user_id === user.id)
    .map((a) => a.team_id)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar displayName={leagueUser?.display_name || user.email || 'Player'} />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">2026 NFL Pool</h1>
          <p className="text-gray-500 text-sm mt-0.5">Season standings · Week {currentWeek}</p>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Standings</h2>
          <StandingsTable standings={standings} />
        </section>

        {weekGames.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Week {currentWeek} Scores
            </h2>
            <WeeklyScores games={weekGames as any} myTeamIds={myTeamIds} />
          </section>
        )}
      </main>
    </div>
  )
}