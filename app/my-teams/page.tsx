import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import TeamCard from '@/components/TeamCard'

export const revalidate = 30

export default async function MyTeamsPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leagueUser } = await supabase
    .from('league_users')
    .select('id, display_name, email')
    .eq('id', user.id)
    .single()

  // My team assignments
  const { data: assignments } = await supabase
    .from('team_assignments')
    .select(`
      user_id, team_id, draft_pick,
      nfl_teams(id, name, abbreviation, city, full_name, conference, division, logo_url, primary_color)
    `)
    .eq('user_id', user.id)
    .order('draft_pick')

  // My double points designations
  const { data: dpWeeks } = await supabase
    .from('double_points_weeks')
    .select('id, team_id, week, season, locked')
    .eq('user_id', user.id)

  // All games for my teams
  const myTeamIds = (assignments || []).map((a) => a.team_id)

  const { data: games } = await supabase
    .from('nfl_games')
    .select(`
      id, season, week, season_type, is_playoff, playoff_round,
      home_team_id, away_team_id, home_score, away_score,
      status, kickoff_time, home_spread, spread_locked,
      home_team:nfl_teams!nfl_games_home_team_id_fkey(id, name, abbreviation, city, full_name, conference, division, logo_url, primary_color),
      away_team:nfl_teams!nfl_games_away_team_id_fkey(id, name, abbreviation, city, full_name, conference, division, logo_url, primary_color)
    `)
    .or(myTeamIds.map((id) => `home_team_id.eq.${id},away_team_id.eq.${id}`).join(','))
    .order('kickoff_time')

  // Current week (for double points context)
  const currentSeason = 2026
  const scheduledGames = (games || []).filter(
    (g) => !g.is_playoff && g.season === currentSeason && g.status !== 'final'
  )
  const upcomingWeeks = [...new Set(scheduledGames.map((g) => g.week))].sort((a, b) => a - b)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar displayName={leagueUser?.display_name || user.email || 'Player'} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Teams</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {leagueUser?.display_name} · 2026 Season
          </p>
        </div>

        {/* Double points explainer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
          <strong>Double Points Week:</strong> You can designate one week per team where all points
          are doubled. Pick it anytime before kickoff — it locks automatically when the game
          starts. Applies to regular season only, no ties in playoffs.
        </div>

        {assignments && assignments.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {assignments.map((assignment) => {
              const team = assignment.nfl_teams as any
              const teamGames = (games || []).filter(
                (g) => g.home_team_id === team.id || g.away_team_id === team.id
              )
              const dpw = (dpWeeks || []).find((d) => d.team_id === team.id)

              return (
                <TeamCard
                  key={assignment.team_id}
                  team={team}
                  games={teamGames as any}
                  doublePointsWeek={dpw || null}
                  upcomingWeeks={upcomingWeeks}
                  userId={user.id}
                  currentSeason={currentSeason}
                />
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
            No teams assigned yet. Check back after the draft!
          </div>
        )}
      </main>
    </div>
  )
}
