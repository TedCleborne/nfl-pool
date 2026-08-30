'use client'

import { useState } from 'react'
import { NflGame, NflTeam } from '@/types'
import { calculateGamePoints } from '@/lib/scoring'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Game extends NflGame {
  home_team: NflTeam
  away_team: NflTeam
}

interface DoublePointsWeek {
  id: number
  team_id: number
  week: number
  season: number
  locked: boolean
}

interface TeamCardProps {
  team: NflTeam
  games: Game[]
  doublePointsWeek: DoublePointsWeek | null
  upcomingWeeks: number[]
  userId: string
  currentSeason: number
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
  })
}

function spreadLabel(homeSpread: number | null, isHomeTeam: boolean): string {
  if (homeSpread === null) return 'No line yet'
  const teamSpread = isHomeTeam ? homeSpread : -homeSpread
  const isUnderdog = teamSpread > 0
  const formatted = teamSpread > 0 ? `+${teamSpread}` : `${teamSpread}`
  return `${formatted} ${isUnderdog ? '🐶 underdog' : 'favorite'}`
}

export default function TeamCard({
  team,
  games,
  doublePointsWeek,
  upcomingWeeks,
  userId,
  currentSeason,
}: TeamCardProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [localDpw, setLocalDpw] = useState<DoublePointsWeek | null>(doublePointsWeek)
  const [selectedWeek, setSelectedWeek] = useState<number>(
    doublePointsWeek?.week ?? upcomingWeeks[0] ?? 1
  )

  const sortedGames = [...games].sort((a, b) => a.week - b.week)
  const nextGame = sortedGames.find((g) => g.status === 'scheduled')

  const gameResults = sortedGames.map((game) => {
    const isDoublePointsWeek =
      localDpw !== undefined &&
      localDpw !== null &&
      game.week === localDpw.week &&
      !game.is_playoff
    return {
      game,
      result: calculateGamePoints({ game: game as any, teamId: team.id, isDoublePointsWeek }),
      isDoublePointsWeek,
    }
  })

  const totalPoints = gameResults.reduce((sum, r) => sum + r.result.points, 0)
  const wins = gameResults.filter(
    (r) => r.result.team_score !== null && r.result.opponent_score !== null &&
      r.result.team_score > r.result.opponent_score
  ).length
  const losses = gameResults.filter(
    (r) => r.result.team_score !== null && r.result.opponent_score !== null &&
      r.result.team_score < r.result.opponent_score
  ).length
  const ties = gameResults.filter(
    (r) => r.result.team_score !== null && r.result.opponent_score !== null &&
      r.result.team_score === r.result.opponent_score
  ).length

  async function saveDoublePointsWeek() {
    setSaving(true)
    const supabase = createBrowserSupabaseClient()

    if (localDpw) {
      const { error } = await supabase
        .from('double_points_weeks')
        .update({ week: selectedWeek })
        .eq('id', localDpw.id)
        .eq('locked', false)
      if (!error) setLocalDpw({ ...localDpw, week: selectedWeek })
    } else {
      const { data, error } = await supabase
        .from('double_points_weeks')
        .insert({
          user_id: userId,
          team_id: team.id,
          week: selectedWeek,
          season: currentSeason,
          locked: false,
        })
        .select()
        .single()
      if (!error && data) setLocalDpw(data as DoublePointsWeek)
    }

    setSaving(false)
    router.refresh()
  }

  async function clearDoublePointsWeek() {
    if (!localDpw || localDpw.locked) return
    setSaving(true)
    const supabase = createBrowserSupabaseClient()
    await supabase.from('double_points_weeks').delete().eq('id', localDpw.id)
    setLocalDpw(null)
    setSaving(false)
    router.refresh()
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
        const isUnderdog = nextGame.home_spread !== null && (isHome ? nextGame.home_spread > 3.5 : -nextGame.home_spread > 3.5)
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

      {/* ── Record + Double Points ─────────────────────────── */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {wins}W – {losses}L{ties > 0 ? ` – ${ties}T` : ''}
        </span>

        <div className="flex items-center gap-2">
          {localDpw?.locked ? (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
              🔒 2× Week {localDpw.week}
            </span>
          ) : upcomingWeeks.length > 0 ? (
            <>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-nfl-navy"
                disabled={saving}
              >
                {upcomingWeeks.map((w) => (
                  <option key={w} value={w}>2× Week {w}</option>
                ))}
              </select>
              <button
                onClick={saveDoublePointsWeek}
                disabled={saving || selectedWeek === localDpw?.week}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-2.5 py-1 rounded-md disabled:opacity-50 transition"
              >
                {saving ? '…' : localDpw ? 'Update' : 'Set'}
              </button>
              {localDpw && (
                <button
                  onClick={clearDoublePointsWeek}
                  disabled={saving}
                  className="text-xs text-gray-400 hover:text-red-500 transition"
                  title="Clear double points week"
                >✕</button>
              )}
            </>
          ) : (
            <span className="text-xs text-gray-400">No upcoming games</span>
          )}
        </div>
      </div>

      {/* ── Game-by-game results ───────────────────────────── */}
      <div className="divide-y divide-gray-50">
        {gameResults.length === 0 && (
          <div className="px-5 py-4 text-sm text-gray-400">No game data yet — sync scores to load schedule.</div>
        )}
        {gameResults.map(({ game, result, isDoublePointsWeek }) => {
          const isHome = game.home_team_id === team.id
          const opponent = isHome ? game.away_team : game.home_team
          const isUpcoming = game.status === 'scheduled'
          const isLive = game.status === 'in_progress'

          return (
            <div
              key={game.id}
              className={`px-5 py-2.5 flex items-center justify-between text-sm ${
                isDoublePointsWeek ? 'bg-amber-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400 w-14 text-xs">
                  {game.is_playoff ? game.playoff_round : `Wk ${game.week}`}
                  {isDoublePointsWeek && <span className="ml-1 text-amber-500">2×</span>}
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