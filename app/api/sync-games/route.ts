/**
 * POST /api/sync-games
 * Syncs ESPN game data (scores + schedule) into Supabase.
 * Call this via a Vercel cron job or manually during game days.
 *
 * Also syncs spreads from The Odds API for games not yet started.
 *
 * Secured by a simple API key in the Authorization header.
 * Set CRON_SECRET in your env and call with:
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { fetchCurrentWeek, fetchWeekScoreboard } from '@/lib/espn'
import { fetchNflSpreads, matchSpreadToGame } from '@/lib/odds'

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminClient()

    // Determine current week
    const { season, week, seasonType } = await fetchCurrentWeek()
    console.log(`Syncing season ${season} week ${week} (type ${seasonType})`)

    // Fetch games from ESPN
    const espnGames = await fetchWeekScoreboard(season, week, seasonType)
    console.log(`Found ${espnGames.length} games`)

    // Fetch spreads from The Odds API (only for scheduled/upcoming games)
    let oddsGames: Awaited<ReturnType<typeof fetchNflSpreads>> = []
    try {
      oddsGames = await fetchNflSpreads()
    } catch (err) {
      console.warn('Could not fetch spreads:', err)
    }

    // Get team espn_id → db id mapping
    const { data: dbTeams } = await supabase
      .from('nfl_teams')
      .select('id, espn_id, full_name, city')
    const teamMap = new Map(dbTeams?.map((t) => [t.espn_id, t]) || [])

    const gamesToUpsert = []

    for (const game of espnGames) {
      const homeTeam = teamMap.get(game.homeTeamEspnId)
      const awayTeam = teamMap.get(game.awayTeamEspnId)

      if (!homeTeam || !awayTeam) {
        console.warn(`Could not find teams for game ${game.id}`)
        continue
      }

      // Get existing game to check if spread is already locked
      const { data: existing } = await supabase
        .from('nfl_games')
        .select('home_spread, spread_locked')
        .eq('id', game.id)
        .single()

      let homeSpread = existing?.home_spread ?? null
      let spreadLocked = existing?.spread_locked ?? false

      // Lock the spread when game starts or is final
      if (game.status !== 'scheduled' && !spreadLocked) {
        spreadLocked = true
        // If we don't have a spread yet, try to get it one last time
        if (homeSpread === null && oddsGames.length > 0) {
          const matched = matchSpreadToGame(
            oddsGames,
            homeTeam.full_name || homeTeam.city,
            awayTeam.full_name || awayTeam.city,
            game.kickoffTime
          )
          homeSpread = matched.homeSpread
        }
      }

      // Update spread from Odds API for scheduled games
      if (game.status === 'scheduled' && !spreadLocked && oddsGames.length > 0) {
        const matched = matchSpreadToGame(
          oddsGames,
          homeTeam.full_name || homeTeam.city,
          awayTeam.full_name || awayTeam.city,
          game.kickoffTime
        )
        if (matched.homeSpread !== null) {
          homeSpread = matched.homeSpread
        }
      }

      gamesToUpsert.push({
        id: game.id,
        season: game.season,
        week: game.week,
        season_type: seasonType,
        is_playoff: game.isPlayoff,
        playoff_round: game.playoffRound || null,
        home_team_id: homeTeam.id,
        away_team_id: awayTeam.id,
        home_score: game.homeScore,
        away_score: game.awayScore,
        status: game.status,
        kickoff_time: game.kickoffTime,
        home_spread: homeSpread,
        spread_locked: spreadLocked,
      })
    }

    const { error } = await supabase
      .from('nfl_games')
      .upsert(gamesToUpsert, { onConflict: 'id' })

    if (error) {
      console.error('Error upserting games:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also lock double_points_weeks for any game that has started
    for (const game of espnGames) {
      if (game.status !== 'scheduled') {
        await supabase
          .from('double_points_weeks')
          .update({ locked: true })
          .eq('week', game.week)
          .eq('season', game.season)
          .eq('locked', false)
      }
    }

    return NextResponse.json({
      ok: true,
      season,
      week,
      gamesUpserted: gamesToUpsert.length,
    })
  } catch (err) {
    console.error('sync-games error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Also allow GET for easy manual triggering from browser (no auth in dev)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Use POST in production' }, { status: 405 })
  }
  return POST(request)
}
