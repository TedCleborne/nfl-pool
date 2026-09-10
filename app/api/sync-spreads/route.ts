/**
 * POST /api/sync-spreads
 * Fetches current NFL spreads from The Odds API and updates any game
 * in the DB that is still "scheduled" and not yet spread_locked.
 *
 * Secured by CRON_SECRET env var (set the same value in Vercel → Settings → Env).
 * Called automatically by Vercel Cron Jobs right before each kickoff window.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
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

    // Fetch spreads from The Odds API
    const oddsGames = await fetchNflSpreads()

    // Get all scheduled (not yet started) unlocked games from our DB
    const { data: scheduledGames, error: fetchError } = await supabase
      .from('nfl_games')
      .select(`
        id, kickoff_time, home_spread, spread_locked,
        home_team:nfl_teams!nfl_games_home_team_id_fkey(id, full_name, city),
        away_team:nfl_teams!nfl_games_away_team_id_fkey(id, full_name, city)
      `)
      .eq('status', 'scheduled')
      .eq('spread_locked', false)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    let updated = 0

    for (const game of scheduledGames || []) {
      const homeTeam = game.home_team as any
      const awayTeam = game.away_team as any

      const matched = matchSpreadToGame(
        oddsGames,
        homeTeam.full_name || homeTeam.city,
        awayTeam.full_name || awayTeam.city,
        game.kickoff_time
      )

      if (matched.homeSpread !== null && matched.homeSpread !== game.home_spread) {
        await supabase
          .from('nfl_games')
          .update({ home_spread: matched.homeSpread })
          .eq('id', game.id)
        updated++
      }
    }

    return NextResponse.json({
      ok: true,
      gamesChecked: scheduledGames?.length ?? 0,
      spreadsUpdated: updated,
    })
  } catch (err) {
    console.error('sync-spreads error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Allow GET so it can be triggered manually from the admin panel
export async function GET(request: NextRequest) {
  return POST(request)
}
