import { UserStanding, BonusWinGame } from '@/types'

interface StandingsTableProps {
  standings: UserStanding[]
}

function Tooltip({ children, lines }: { children: React.ReactNode; lines: string[] }) {
  return (
    <span className="relative group inline-flex items-center justify-center cursor-default">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-left leading-relaxed z-50 whitespace-normal">
        {lines.map((line, i) => (
          <span key={i} className="block">{line}</span>
        ))}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  )
}

function underdogTip(games: BonusWinGame[]): string[] {
  return games.map(
    (g) => `Wk ${g.week}: ${g.team_name} def. ${g.opponent_name} (+${g.spread}) → +1`
  )
}

function blowoutTip(games: BonusWinGame[]): string[] {
  return games.map(
    (g) => `Wk ${g.week}: ${g.team_name} def. ${g.opponent_name} (by ${g.margin}) → +1`
  )
}

export default function StandingsTable({ standings }: StandingsTableProps) {
  if (standings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        No standings yet — check back after Week 1!
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-nfl-navy text-white text-left">
            <th className="px-4 py-3 font-semibold w-8">#</th>
            <th className="px-4 py-3 font-semibold">Player</th>
            <th className="px-4 py-3 font-semibold text-center">Pts</th>
            <th className="px-4 py-3 font-semibold text-center hidden sm:table-cell">W</th>
            <th className="px-4 py-3 font-semibold text-center hidden sm:table-cell">L</th>
            <th className="px-4 py-3 font-semibold text-center hidden sm:table-cell">T</th>
            <th className="px-4 py-3 font-semibold text-center hidden md:table-cell">🐶 Wins</th>
            <th className="px-4 py-3 font-semibold text-center hidden md:table-cell">💥 Wins</th>
            <th className="px-4 py-3 font-semibold">Teams</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {standings.map((standing, index) => (
            <tr
              key={standing.user_id}
              className={`hover:bg-gray-50 transition ${index === 0 ? 'font-semibold' : ''}`}
            >
              {/* Rank */}
              <td className="px-4 py-3 text-gray-500">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
              </td>

              {/* Name */}
              <td className="px-4 py-3 text-gray-900">{standing.display_name}</td>

              {/* Points */}
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center justify-center w-10 h-7 rounded-full bg-nfl-navy text-white font-bold text-sm">
                  {standing.total_points}
                </span>
              </td>

              {/* W/L/T */}
              <td className="px-4 py-3 text-center text-gray-600 hidden sm:table-cell">
                {standing.wins}
              </td>
              <td className="px-4 py-3 text-center text-gray-600 hidden sm:table-cell">
                {standing.losses}
              </td>
              <td className="px-4 py-3 text-center text-gray-600 hidden sm:table-cell">
                {standing.ties}
              </td>

              {/* Underdog wins */}
              <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell overflow-visible">
                {standing.underdog_wins > 0 ? (
                  <Tooltip lines={underdogTip(standing.underdog_win_games)}>
                    <span className="text-amber-600 font-medium underline decoration-dotted">
                      {standing.underdog_wins}
                    </span>
                  </Tooltip>
                ) : (
                  '—'
                )}
              </td>

              {/* Blowout wins */}
              <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell overflow-visible">
                {standing.blowout_wins > 0 ? (
                  <Tooltip lines={blowoutTip(standing.blowout_win_games)}>
                    <span className="text-orange-600 font-medium underline decoration-dotted">
                      {standing.blowout_wins}
                    </span>
                  </Tooltip>
                ) : (
                  '—'
                )}
              </td>

              {/* Teams */}
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {standing.teams.map((t) => (
                    <span
                      key={t.team.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: t.team.primary_color || '#013369' }}
                      title={`${t.team.full_name}: ${t.points} pts (${t.wins}W-${t.losses}L${t.ties > 0 ? `-${t.ties}T` : ''})`}
                    >
                      {t.team.abbreviation}
                      <span className="opacity-80">{t.points > 0 ? `+${t.points}` : t.points}</span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex gap-4 flex-wrap">
        <span>Pts = total points</span>
        <span>🐶 Wins = underdog wins (7+ pt dog, +1 bonus)</span>
        <span>💥 Wins = blowout wins (25+ pts, +1 bonus)</span>
        <span>T (tie) = −1 pt</span>
      </div>
    </div>
  )
}
