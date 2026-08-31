import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { fetchWeekScoreboard } from '@/lib/espn'

const SEASON = 2026
const TOTAL_WEEKS = 18

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Get team espn_id → db id mapping
    const { data: dbTeams } = await supabase
      .from('nfl_teams')
      .select('id, espn_id, full_name, city')
    const teamMap = new Map(dbTeams?.map((t) => [t.espn_id, t]) || [])

    let totalUpserted = 0
    const errors: string[] = []

    for (let week = 1; week <= TOTAL_WEEKS; week++) {
      try {
        const espnGames = await fetchWeekScoreboard(SEASON, week, 2)
        if (espnGames.length === 0) continue

        const gamesToUpsert = []

        for (const game of espnGames) {
          const homeTeam = teamMap.get(game.homeTeamEspnId)
          const awayTeam = teamMap.get(game.awayTeamEspnId)
          if (!homeTeam || !awayTeam) continue

          // Get existing spread data so we don't overwrite locked spreads
          const { data: existing } = await supabase
            .from('nfl_games')
            .select('home_spread, spread_locked')
            .eq('id', game.id)
            .single()

          gamesToUpsert.push({
            id: game.id,
            season: game.season,
            week: game.week,
            season_type: 2,
            is_playoff: false,
            playoff_round: null,
            home_team_id: homeTeam.id,
            away_team_id: awayTeam.id,
            home_score: game.homeScore,
            away_score: game.awayScore,
            status: game.status,
            kickoff_time: game.kickoffTime,
            home_spread: existing?.home_spread ?? null,
            spread_locked: existing?.spread_locked ?? false,
          })
        }

        const { error } = await supabase
          .from('nfl_games')
          .upsert(gamesToUpsert, { onConflict: 'id' })

        if (error) {
          errors.push(`Week ${week}: ${error.message}`)
        } else {
          totalUpserted += gamesToUpsert.length
        }
      } catch (err) {
        errors.push(`Week ${week}: ${String(err)}`)
      }
    }

    return NextResponse.json({
      ok: true,
      season: SEASON,
      weeksProcessed: TOTAL_WEEKS,
      gamesUpserted: totalUpserted,
      errors,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}