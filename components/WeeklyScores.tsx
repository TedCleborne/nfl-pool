import { NflGame, NflTeam, TeamAssignment } from '@/types'

interface Game extends NflGame {
  home_team: NflTeam
  away_team: NflTeam
}

interface Assignment {
  user_id: string
  team_id: number
  nfl_teams: NflTeam
}

interface WeeklyScoresProps {
  games: Game[]
  assignments: Assignment[]
}

function formatKickoff(isoString: string) {
  const d = new Date(isoString)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function getOwnerName(teamId: number, assignments: Assignment[]): string | null {
  const assignment = assignments.find((a) => a.team_id === teamId)
  return assignment ? null : null // We'd need league_users joined — handled in page
}

export default function WeeklyScores({ games, assignments }: WeeklyScoresProps) {
  // Build a set of pool team IDs for quick lookup
  const poolTeamIds = new Set(assignments.map((a) => a.team_id))

  // Sort: in-progress first, then scheduled, then final
  const sorted = [...games].sort((a, b) => {
    const order = { in_progress: 0, scheduled: 1, final: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((game) => {
        const homeIsPool = poolTeamIds.has(game.home_team_id)
        const awayIsPool = poolTeamIds.has(game.away_team_id)
        const hasPoolTeam = homeIsPool || awayIsPool

        return (
          <div
            key={game.id}
            className={`bg-white rounded-xl border p-4 ${
              hasPoolTeam ? 'border-nfl-gold shadow-sm' : 'border-gray-200'
            }`}
          >
            {/* Status badge */}
            <div className="flex justify-between items-center mb-3">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  game.status === 'final'
                    ? 'bg-gray-100 text-gray-500'
                    : game.status === 'in_progress'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                {game.status === 'final'
                  ? 'Final'
                  : game.status === 'in_progress'
                  ? '🔴 Live'
                  : formatKickoff(game.kickoff_time)}
              </span>
              {game.home_spread !== null && (
                <span className="text-xs text-gray-400">
                  Spread: {game.home_spread > 0 ? '+' : ''}{game.home_spread}
                </span>
              )}
            </div>

            {/* Teams + Scores */}
            <div className="space-y-2">
              {[
                { team: game.away_team, score: game.away_score, isPool: awayIsPool },
                { team: game.home_team, score: game.home_score, isPool: homeIsPool },
              ].map(({ team, score, isPool }) => (
                <div key={team.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Team color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team.primary_color || '#013369' }}
                    />
                    <span
                      className={`text-sm ${
                        isPool ? 'font-bold text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {team.abbreviation}
                      {isPool && (
                        <span className="ml-1 text-xs font-normal text-amber-600">★</span>
                      )}
                    </span>
                    {isPool && (
                      <span className="text-xs text-gray-400 hidden sm:inline">
                        {team.full_name}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      score !== null ? 'text-gray-900' : 'text-gray-300'
                    }`}
                  >
                    {score !== null ? score : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
