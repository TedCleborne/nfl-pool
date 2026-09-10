'use client'

import { useState } from 'react'
import { NflGame, NflTeam } from '@/types'

interface Game extends NflGame {
  home_team: NflTeam
  away_team: NflTeam
}

interface WeeklyScoresProps {
  games: Game[]
  myTeamIds: number[]
  currentWeek: number
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
    timeZone: 'America/New_York',
  })
}

export default function WeeklyScores({ games, myTeamIds, currentWeek }: WeeklyScoresProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)

  const myTeamSet = new Set(myTeamIds)

  const allWeeks = Array.from(new Set(games.map((g) => g.week))).sort((a, b) => a - b)

  const weekGames = games.filter((g) => g.week === selectedWeek)

  // Sort: in-progress first, then scheduled, then final
  const sorted = [...weekGames].sort((a, b) => {
    const order = { in_progress: 0, scheduled: 1, final: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3)
  })

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Week {selectedWeek} Scores</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedWeek((w) => Math.max(allWeeks[0] ?? 1, w - 1))}
            disabled={selectedWeek <= (allWeeks[0] ?? 1)}
            className="px-2 py-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition"
          >
            ←
          </button>
          <span className="text-sm text-gray-500 w-16 text-center">Week {selectedWeek}</span>
          <button
            onClick={() => setSelectedWeek((w) => Math.min(allWeeks[allWeeks.length - 1] ?? 18, w + 1))}
            disabled={selectedWeek >= (allWeeks[allWeeks.length - 1] ?? 18)}
            className="px-2 py-1 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((game) => {
          const homeIsPool = myTeamSet.has(game.home_team_id)
          const awayIsPool = myTeamSet.has(game.away_team_id)
          const hasPoolTeam = homeIsPool || awayIsPool

          return (
            <div
              key={game.id}
              className={`bg-white rounded-xl border p-4 ${
                hasPoolTeam ? 'border-amber-400 shadow-sm' : 'border-gray-200'
              }`}
            >
              {/* Status + spread */}
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
                {game.home_spread !== null && (() => {
                  const favoredTeam = game.home_spread <= 0 ? game.home_team : game.away_team
                  const spread = game.home_spread <= 0 ? game.home_spread : -game.home_spread
                  return (
                    <span className="text-xs text-gray-400">
                      {favoredTeam.abbreviation} {spread}
                    </span>
                  )
                })()}
              </div>

              {/* Teams + Scores */}
              <div className="space-y-2">
                {[
                  { team: game.away_team, score: game.away_score, isPool: awayIsPool },
                  { team: game.home_team, score: game.home_score, isPool: homeIsPool },
                ].map(({ team, score, isPool }) => (
                  <div key={team.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: team.primary_color || '#013369' }}
                      />
                      <span className={`text-sm ${isPool ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                        {team.abbreviation}
                        {isPool && <span className="ml-1 text-xs font-normal text-amber-600">★</span>}
                      </span>
                      {isPool && (
                        <span className="text-xs text-gray-400 hidden sm:inline">{team.full_name}</span>
                      )}
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${score !== null ? 'text-gray-900' : 'text-gray-300'}`}>
                      {score !== null ? score : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {sorted.length === 0 && (
          <div className="col-span-2 text-center text-gray-400 py-8">
            No games found for Week {selectedWeek}.
          </div>
        )}
      </div>
    </div>
  )
}
