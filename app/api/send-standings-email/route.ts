/**
 * POST /api/send-standings-email
 * Fetches current standings and sends a weekly HTML email to all pool members.
 * Called automatically by a scheduled task every Monday at 9am ET,
 * or manually via the admin panel.
 *
 * Env vars required:
 *   RESEND_API_KEY   — from resend.com
 *   EMAIL_FROM       — e.g. "NFL Pool <noreply@yourdomain.com>"
 *   CRON_SECRET      — same secret used for other sync routes
 *   NEXT_PUBLIC_APP_URL — e.g. https://nfl-pool.vercel.app
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'
import { calculateStandings } from '@/lib/scoring'

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  try {
    const supabase = createAdminClient()
    const resend = new Resend(resendKey)

    // Fetch all data (same as dashboard)
    const [
      { data: users },
      { data: assignments },
      { data: games },
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
    ])

    if (!users || !assignments || !games) {
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    // Determine current week
    const scheduledOrLive = games.filter(
      (g) => !g.is_playoff && (g.status === 'scheduled' || g.status === 'in_progress')
    )
    const currentWeek = scheduledOrLive.length > 0
      ? Math.min(...scheduledOrLive.map((g) => g.week))
      : games.length > 0
        ? Math.max(...games.filter((g) => !g.is_playoff).map((g) => g.week))
        : 1

    const completedWeek = currentWeek - 1

    // Calculate standings
    const standings = calculateStandings({
      users: users as any,
      assignments: assignments as any,
      games: games as any,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nfl-pool.vercel.app'
    const fromEmail = process.env.EMAIL_FROM || 'NFL Pool <noreply@resend.dev>'

    // Build HTML email
    const html = buildStandingsEmail(standings, completedWeek, appUrl)

    // Get recipient emails
    // If ?test=1 is passed (or called from admin manually), send only to admin
    const url = new URL(request.url)
    const isTest = url.searchParams.get('test') === '1'
    const emails = isTest
      ? ['ted.cleborne@gmail.com']
      : users.map((u) => u.email).filter(Boolean)

    const { data: sendData, error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: emails,
      subject: `🏈 NFL Pool Standings — Week ${completedWeek} Complete`,
      html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: String(sendError) }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      week: completedWeek,
      recipients: emails.length,
      messageId: sendData?.id,
    })
  } catch (err) {
    console.error('send-standings-email error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Allow GET for manual triggering from admin panel
export async function GET(request: NextRequest) {
  return POST(request)
}

// ─── Email template ────────────────────────────────────────────────────────────

function medal(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `${rank}.`
}

function buildStandingsEmail(
  standings: Awaited<ReturnType<typeof calculateStandings>>,
  week: number,
  appUrl: string
): string {
  const rows = standings
    .map((s, i) => {
      const rank = i + 1
      const record = `${s.wins}-${s.losses}${s.ties > 0 ? `-${s.ties}` : ''}`
      const bonuses = [
        s.underdog_wins > 0 ? `🐶 ${s.underdog_wins}` : '',
        s.blowout_wins > 0 ? `💥 ${s.blowout_wins}` : '',
      ].filter(Boolean).join(' &nbsp; ')

      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 10px 8px; font-size: 14px; color: #6b7280;">${medal(rank)}</td>
          <td style="padding: 10px 8px; font-size: 14px; font-weight: 600; color: #111827;">${s.display_name}</td>
          <td style="padding: 10px 8px; font-size: 14px; text-align: center; color: #374151;">${record}</td>
          <td style="padding: 10px 8px; font-size: 18px; font-weight: 700; text-align: right; color: #013369;">${s.total_points}</td>
          <td style="padding: 10px 8px; font-size: 13px; text-align: right; color: #6b7280;">${bonuses}</td>
        </tr>
      `
    })
    .join('')

  const leader = standings[0]
  const secondPlace = standings[1]
  const gap = leader && secondPlace ? leader.total_points - secondPlace.total_points : 0

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NFL Pool Standings</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 560px; margin: 32px auto; padding: 0 16px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #013369 0%, #0a2d6e 100%); border-radius: 16px 16px 0 0; padding: 28px 28px 24px;">
      <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">🏈 NFL Pool</div>
      <div style="font-size: 14px; color: #93c5fd; margin-top: 4px;">Week ${week} is in the books</div>
    </div>

    <!-- Standings card -->
    <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; width: 32px;"></th>
            <th style="padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Player</th>
            <th style="padding: 10px 8px; text-align: center; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">W-L</th>
            <th style="padding: 10px 8px; text-align: right; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Pts</th>
            <th style="padding: 10px 8px; text-align: right; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Bonus</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <!-- Footer note -->
      <div style="padding: 14px 16px; background: #f9fafb; border-top: 1px solid #f3f4f6;">
        <div style="font-size: 11px; color: #9ca3af; line-height: 1.6;">
          🐶 = underdog win (+1 bonus) &nbsp;·&nbsp; 💥 = blowout win 25+ pts (+1 bonus) &nbsp;·&nbsp; Tie = −1 pt
        </div>
        ${leader && gap > 0 ? `
        <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
          ${leader.display_name} leads by <strong>${gap} point${gap !== 1 ? 's' : ''}</strong>
        </div>` : ''}
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin-top: 20px;">
      <a href="${appUrl}/dashboard"
         style="display: inline-block; background: #013369; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">
        View Full Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 20px; padding-bottom: 32px;">
      <p style="font-size: 11px; color: #d1d5db; margin: 0;">
        You're receiving this because you're in the 2026 NFL Pool.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
