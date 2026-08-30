/**
 * NFL Pool Seed Script
 *
 * Run with: npm run seed
 * Requires .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.
 *
 * What it does:
 *  1. Fetches all 32 NFL teams from ESPN and inserts them into nfl_teams
 *  2. Creates 8 test Supabase auth users (ted.cleborne+1 through +8 @gmail.com)
 *  3. Randomly assigns 4 teams to each user (snake draft order)
 *
 * After the real draft, use the /admin page to reassign teams.
 */

import { createClient } from '@supabase/supabase-js'

// Load env manually (tsx doesn't auto-load .env.local)
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  dotenv.config()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Test Users ───────────────────────────────────────────────────────────────
// After the real draft, use /admin to reassign teams.
// Change BASE_EMAIL to your email if you want to use different aliases.
const BASE_EMAIL = 'ted.cleborne'
const EMAIL_DOMAIN = 'gmail.com'
const DEFAULT_PASSWORD = 'NFLPool2026!'  // Everyone gets the same password for testing

const TEST_USERS = [
  { alias: '+1', displayName: 'Ted' },
  { alias: '+2', displayName: 'Player 2' },
  { alias: '+3', displayName: 'Player 3' },
  { alias: '+4', displayName: 'Player 4' },
  { alias: '+5', displayName: 'Player 5' },
  { alias: '+6', displayName: 'Player 6' },
  { alias: '+7', displayName: 'Player 7' },
  { alias: '+8', displayName: 'Player 8' },
]

// ─── ESPN Teams Fetch ─────────────────────────────────────────────────────────
async function fetchEspnTeams() {
  console.log('Fetching NFL teams from ESPN...')
  const res = await fetch(
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=32'
  )
  const data = await res.json()

  return data.sports[0].leagues[0].teams.map((t: any) => {
    const team = t.team
    return {
      espn_id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      city: team.location,
      full_name: team.displayName,
      conference: team.groups?.parent?.abbreviation || '',
      division: team.groups?.abbreviation || '',
      logo_url: team.logos?.[0]?.href || '',
      primary_color: team.color ? `#${team.color}` : '#013369',
    }
  })
}

// ─── Snake Draft Assignment ───────────────────────────────────────────────────
// Simulates a snake draft: rounds alternate direction
// Round 1: 1→8, Round 2: 8→1, Round 3: 1→8, Round 4: 8→1
function snakeDraftOrder(numUsers: number, picksPerUser: number): number[] {
  const order: number[] = []
  for (let round = 0; round < picksPerUser; round++) {
    const roundOrder = Array.from({ length: numUsers }, (_, i) => i)
    if (round % 2 === 1) roundOrder.reverse()
    order.push(...roundOrder)
  }
  return order
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== NFL Pool Seed Script ===\n')

  // 1. Seed NFL teams
  const teams = await fetchEspnTeams()
  console.log(`Inserting ${teams.length} NFL teams...`)
  const { error: teamsError } = await supabase
    .from('nfl_teams')
    .upsert(teams, { onConflict: 'espn_id' })
  if (teamsError) {
    console.error('Error inserting teams:', teamsError)
    process.exit(1)
  }

  const { data: dbTeams } = await supabase
    .from('nfl_teams')
    .select('id, full_name, abbreviation')
    .order('id')
  console.log(`✓ ${dbTeams?.length} teams in database`)

  // Shuffle teams randomly for assignment
  const shuffledTeams = [...(dbTeams || [])].sort(() => Math.random() - 0.5)

  // 2. Create test users
  console.log('\nCreating test users...')
  const createdUsers: Array<{ id: string; email: string; displayName: string }> = []

  for (const user of TEST_USERS) {
    const email = `${BASE_EMAIL}${user.alias}@${EMAIL_DOMAIN}`

    // Check if user already exists
    const { data: existing } = await supabase
      .from('league_users')
      .select('id')
      .eq('email', email)
      .single()

    let userId: string

    if (existing) {
      userId = existing.id
      console.log(`  ↩  ${email} already exists, skipping auth creation`)
    } else {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      })

      if (authError) {
        console.error(`  ✗ Error creating ${email}:`, authError.message)
        continue
      }

      userId = authData.user.id

      // Insert league_users row
      const { error: luError } = await supabase.from('league_users').insert({
        id: userId,
        display_name: user.displayName,
        email,
      })

      if (luError) {
        console.error(`  ✗ Error inserting league_user for ${email}:`, luError.message)
        continue
      }

      console.log(`  ✓ Created ${email} (${user.displayName})`)
    }

    createdUsers.push({ id: userId, email, displayName: user.displayName })
  }

  // 3. Assign teams via snake draft
  console.log('\nAssigning teams (snake draft order)...')

  // Clear existing assignments first
  await supabase.from('team_assignments').delete().neq('id', 0)

  const draftOrder = snakeDraftOrder(createdUsers.length, 4)
  const assignments = draftOrder.map((userIndex, pickIndex) => ({
    user_id: createdUsers[userIndex].id,
    team_id: shuffledTeams[pickIndex].id,
    draft_pick: Math.floor(
      createdUsers
        .slice(0, userIndex + 1)
        .filter((_, i) => draftOrder.slice(0, pickIndex + 1).includes(i)).length
    ),
  }))

  // Simpler approach: assign in chunks of 4
  const simpleAssignments: Array<{
    user_id: string
    team_id: number
    draft_pick: number
  }> = []

  createdUsers.forEach((user, userIdx) => {
    // Each user gets 4 teams from the shuffled list
    for (let pick = 0; pick < 4; pick++) {
      const teamIdx = userIdx * 4 + pick
      if (teamIdx < shuffledTeams.length) {
        simpleAssignments.push({
          user_id: user.id,
          team_id: shuffledTeams[teamIdx].id,
          draft_pick: pick + 1,
        })
      }
    }
  })

  const { error: assignError } = await supabase
    .from('team_assignments')
    .insert(simpleAssignments)

  if (assignError) {
    console.error('Error inserting team assignments:', assignError)
  } else {
    console.log(`✓ ${simpleAssignments.length} team assignments created`)

    // Print summary
    console.log('\n── Draft Results ──────────────────────────────────')
    for (const user of createdUsers) {
      const userTeams = simpleAssignments
        .filter((a) => a.user_id === user.id)
        .map((a) => shuffledTeams.find((t) => t.id === a.team_id)?.abbreviation)
        .join(', ')
      console.log(`  ${user.displayName.padEnd(12)} ${userTeams}`)
    }
  }

  console.log('\n── Login Credentials ──────────────────────────────')
  for (const user of TEST_USERS) {
    console.log(`  ${BASE_EMAIL}${user.alias}@${EMAIL_DOMAIN}  /  ${DEFAULT_PASSWORD}`)
  }

  console.log('\n✓ Seed complete!\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
