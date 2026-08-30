/**
 * GET  /api/admin/teams  — list all users and their team assignments
 * PUT  /api/admin/teams  — reassign teams after the real draft
 *
 * Protected by ADMIN_PASSWORD env variable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

function checkAdminAuth(request: NextRequest) {
  const authHeader = request.headers.get('x-admin-password')
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return true // if not set, allow (dev mode)
  return authHeader === adminPassword
}

export async function GET(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: users } = await supabase
    .from('league_users')
    .select('id, display_name, email')
    .order('display_name')

  const { data: assignments } = await supabase
    .from('team_assignments')
    .select('user_id, team_id, draft_pick, nfl_teams(id, full_name, abbreviation, logo_url, primary_color)')
    .order('draft_pick')

  const { data: teams } = await supabase
    .from('nfl_teams')
    .select('id, full_name, abbreviation, logo_url, primary_color')
    .order('full_name')

  return NextResponse.json({ users, assignments, teams })
}

export async function PUT(request: NextRequest) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const body = await request.json()
  // Expected: { assignments: [{ user_id, team_id, draft_pick }] }
  const { assignments } = body as {
    assignments: Array<{ user_id: string; team_id: number; draft_pick: number }>
  }

  if (!assignments || !Array.isArray(assignments)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Validate: exactly 8 users × 4 teams = 32 assignments
  if (assignments.length !== 32) {
    return NextResponse.json(
      { error: `Expected 32 assignments, got ${assignments.length}` },
      { status: 400 }
    )
  }

  // Validate: each team appears exactly once
  const teamIds = assignments.map((a) => a.team_id)
  const uniqueTeams = new Set(teamIds)
  if (uniqueTeams.size !== 32) {
    return NextResponse.json({ error: 'Duplicate teams in assignments' }, { status: 400 })
  }

  // Delete and reinsert
  await supabase.from('team_assignments').delete().neq('id', 0)
  const { error } = await supabase.from('team_assignments').insert(assignments)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: assignments.length })
}
