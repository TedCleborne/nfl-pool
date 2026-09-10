'use client'

import { NflGame, NflTeam } from '@/types'
import { calculateGamePoints } from '@/lib/scoring'

interface Game extends NflGame {
  home_team: NflTeam
  away_team: NflTeam
}

interface TeamCardProps {
  team: NflTeam
  games: Game[]
}

function resultBadge(game: Game, teamId: number) {
  if (game.status !== 'final' || game.home_score === null || game.away_score === null) return null
  const isHome = game.home_team_id === teamId
  const teamScore = isHome ? game.home_score : game.away_score
  const oppScore = isHome ? game.away_score : game.home_score
  if (teamScore > oppScore) return <span className="text-xs font-bold text-green-600">W</span>
  if (teamScore < oppScore) return <span className="text-xs font-bold text-red-500">L</span>
  return <span className="text-xs font-bold text-yellow-600">T</span>
}

function formatGameTime(isoString: string) {
  const d = new Date(isoString)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'America/New_York',
  })
}

function spreadLabel(homeSpread: number | null, isHomeTeam: boolean): string {
  if (homeSpread === null) return 'No line yet'
  const teamSpread = isHomeTeam ? homeSpread : -homeSpread
  const isUnderdog = teamSpread > 0
  const formatted = teamSpread > 0 ? `+${teamSpread}` : `${teamSpread}`
  return `${formatted} ${isUnderdog ? '🐶 underdog' : 'favorite'}`
}

export default function TeamCard({ team, games }: TeamCardProps) {
  // Sort games by week
  const sortedGames = [...games].sort((a, b) => a.week - b.week)

  // Find next upcoming game
  const nextGame = sortedGames.find((g) => g.status === 'scheduled')

  // Calculate points per game
  const gameResults = sortedGames.map((game) => ({
    game,
    result: calculateGamePoints({ game: game as any, teamId: team.id }),
  }))

  const totalPoints = gameResults.reduce((sum, r) => sum + r.result.points, 0)
  const wins = gameResults.filter(
    (r) => r.game.status === 'final' && r.result.team_score !== null && r.result.opponent_score !== null &&
      r.result.team_score > r.result.opponent_score
  ).length
  const losses = gameResults.filter(
    (r) => r.game.status === 'final' && r.result.team_score !== null && r.result.opponent_score !== null &&
      r.result.team_score < r.result.opponent_score
  ).length
  const ties = gameResults.filter(
    (r) => r.game.status === 'final' && r.result.team_score !== null && r.result.opponent_score !== null &&
      r.result.team_score === r.result.opponent_score
  ).length

  // BYE week detection
  const regularGameWeeks = new Set(sortedGames.filter((g) => !g.is_playoff).map((g) => g.week))
  const byeWeek = regularGameWeeks.size > 0
    ? Array.from({ length: 18 }, (_, i) => i + 1).find((w) => !regularGameWeeks.has(w)) ?? null
    : null

  type ScheduleRow =
    | { type: 'game'; game: (typeof gameResults)[0] }
    | { type: 'bye'; week: number }

  const scheduleRows: ScheduleRow[] = []
  for (const gr of gameResults) {
    if (byeWeek !== null && gr.game.week > byeWeek && !scheduleRows.some((r) => r.type === 'bye')) {
      scheduleRows.push({ type: 'bye', week: byeWeek })
    }
    scheduleRows.push({ type: 'game', game: gr })
  }
  if (byeWeek !== null && !scheduleRows.some((r) => r.type === 'bye')) {
    scheduleRows.push({ type: 'bye', week: byeWeek })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">

      {/* ── Team Header ────────────────────────────────────── */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ backgroundColor: team.primary_color || '#013369' }}
      >
        <div className="flex items-center gap-3">
          {team.logo_url && (
            <img src={team.logo_url} alt={team.abbreviation} className="w-10 h-10 object-contain" />
          )}
          <div>
            <div className="text-white font-bold text-lg leading-tight">{team.full_name}</div>
            <div className="text-white/70 text-xs">{team.conference} · {team.division}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white text-2xl font-bold">{totalPoints}</div>
          <div className="text-white/70 text-xs">pts</div>
        </div>
      </div>

      {/* ── Next Game Banner ───────────────────────────────── */}
      {nextGame && (() => {
        const isHome = nextGame.home_team_id === team.id
        const opponent = isHome ? nextGame.away_team : nextGame.home_team
        const spread = spreadLabel(nextGame.home_spread, isHome)
        const isUnderdog = nextGame.home_spread !== null && (isHome ? nextGame.home_spread >= 7 : -nextGame.home_spread >= 7)
        return (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-0.5">
                  Week {nextGame.week} · {formatGameTime(nextGame.kickoff_time)}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: opponent.primary_color || '#888' }}
                  />
                  <span className="text-gray-800 font-semibold">
                    {isHome ? 'vs' : '@'} {opponent.full_name}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  isUnderdog
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {spread}
                </div>
                {isUnderdog && (
                  <div className="text-xs text-amber-600 mt-0.5">Win = +2 pts!</div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Record ─────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-gray-100">
        <span className="text-sm text-gray-600">
          {wins}W – {losses}L{ties > 0 ? ` – ${ties}T` : ''}
        </span>
      </div>

      {/* ── Game-by-game results ───────────────────────────── */}
      <div className="divide-y divide-gray-50">
        {scheduleRows.length === 0 && (
          <div className="px-5 py-4 text-sm text-gray-400">No game data yet — sync scores to load schedule.</div>
        )}
        {scheduleRows.map((row, idx) => {
          if (row.type === 'bye') {
            return (
              <div key={`bye-${row.week}`} className="px-5 py-2.5 flex items-center text-sm bg-gray-50">
                <span className="text-gray-400 w-14 text-xs">Wk {row.week}</span>
                <span className="text-gray-400 italic text-xs">BYE week</span>
              </div>
            )
          }

          const { game, result } = row.game
          const isHome = game.home_team_id === team.id
          const opponent = isHome ? game.away_team : game.home_team
          const isUpcoming = game.status === 'scheduled'
          const isLive = game.status === 'in_progress'

          return (
            <div
              key={game.id}
              className="px-5 py-2.5 flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400 w-14 text-xs">
                  {game.is_playoff ? game.playoff_round : `Wk ${game.week}`}
                </span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: opponent.primary_color || '#888' }}
                />
                <span className={isUpcoming ? 'text-gray-500' : 'text-gray-700'}>
                  {isHome ? 'vs' : '@'} {opponent.abbreviation}
                  {isUpcoming && game.home_spread !== null && (
                    <span className="ml-1.5 text-xs text-gray-400">
                      ({isHome ? game.home_spread > 0 ? `+${game.home_spread}` : game.home_spread : -game.home_spread > 0 ? `+${-game.home_spread}` : -game.home_spread})
                    </span>
                  )}
                </span>
                {isLive && <span className="text-xs text-green-600 font-medium">LIVE</span>}
              </div>

              <div className="flex items-center gap-3">
                {!isUpcoming && result.team_score !== null && (
                  <span className="text-gray-500 text-xs tabular-nums">
                    {result.team_score}–{result.opponent_score}
                  </span>
                )}
                {resultBadge(game, team.id)}
                <span className={`w-8 text-right font-semibold tabular-nums text-sm ${
                  result.points > 1 ? 'text-amber-600'
                  : result.points === 1 ? 'text-green-600'
                  : result.points < 0 ? 'text-red-500'
                  : 'text-gray-300'
                }`}>
                  {isUpcoming ? '—' : result.points > 0 ? `+${result.points}` : result.points === 0 ? '' : result.points}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
