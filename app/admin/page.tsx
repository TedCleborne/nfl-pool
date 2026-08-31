'use client'

import { useState } from 'react'

interface User {
  id: string
  display_name: string
  email: string
}

interface NflTeam {
  id: number
  full_name: string
  abbreviation: string
  logo_url: string
  primary_color: string
}

interface Assignment {
  user_id: string
  team_id: number
  draft_pick: number
  nfl_teams: NflTeam
}

interface AdminData {
  users: User[]
  teams: NflTeam[]
  assignments: Assignment[]
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const [draftMap, setDraftMap] = useState<Record<string, number[]>>({})

  async function fetchData(pw: string) {
    setLoading(true)
    const res = await fetch('/api/admin/teams', {
      headers: { 'x-admin-password': pw },
    })
    if (!res.ok) {
      setAuthError('Incorrect password.')
      setLoading(false)
      return
    }
    const json: AdminData = await res.json()
    setData(json)
    setAuthed(true)

    const map: Record<string, number[]> = {}
    json.users.forEach((u) => { map[u.id] = [0, 0, 0, 0] })
    json.assignments.forEach((a) => {
      const userAssignments = json.assignments
        .filter((x) => x.user_id === a.user_id)
        .sort((x, y) => x.draft_pick - y.draft_pick)
      map[a.user_id] = userAssignments.map((x) => x.team_id)
    })
    setDraftMap(map)
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/sync-games', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setSyncMsg(`✓ Synced! Season ${json.season} Week ${json.week} — ${json.gamesUpserted} games updated.`)
      } else {
        setSyncMsg(`Error: ${json.error}`)
      }
    } catch (e) {
      setSyncMsg('Network error — try again.')
    }
    setSyncing(false)
  }

  async function handleSyncSeason() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/sync-season', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setSyncMsg(`✓ Full season synced! ${json.gamesUpserted} games loaded across ${json.weeksProcessed} weeks.${json.errors?.length ? ` (${json.errors.length} week errors)` : ''}`)
      } else {
        setSyncMsg(`Error: ${json.error}`)
      }
    } catch (e) {
      setSyncMsg('Network error — try again.')
    }
    setSyncing(false)
  }

  async function handleSave() {
    if (!data) return
    setSaving(true)
    setSaveMsg('')

    const assignments: Array<{ user_id: string; team_id: number; draft_pick: number }> = []
    data.users.forEach((user) => {
      const teams = draftMap[user.id] || []
      teams.forEach((teamId, idx) => {
        if (teamId) {
          assignments.push({ user_id: user.id, team_id: teamId, draft_pick: idx + 1 })
        }
      })
    })

    const res = await fetch('/api/admin/teams', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': password,
      },
      body: JSON.stringify({ assignments }),
    })

    const json = await res.json()
    if (res.ok) {
      setSaveMsg('✓ Assignments saved!')
    } else {
      setSaveMsg(`Error: ${json.error}`)
    }
    setSaving(false)
  }

  function assignTeam(userId: string, pickIndex: number, teamId: number) {
    setDraftMap((prev) => {
      const updated = { ...prev }
      Object.keys(updated).forEach((uid) => {
        updated[uid] = updated[uid].map((t, i) => {
          if (t === teamId && !(uid === userId && i === pickIndex)) return 0
          return t
        })
      })
      const userTeams = [...(updated[userId] || [0, 0, 0, 0])]
      userTeams[pickIndex] = teamId
      updated[userId] = userTeams
      return updated
    })
  }

  const assignedTeamIds = new Set(
    Object.values(draftMap).flat().filter(Boolean)
  )
  const unassignedTeams = data?.teams.filter((t) => !assignedTeamIds.has(t.id)) || []

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <h1 className="text-xl font-bold mb-1">Admin Panel</h1>
          <p className="text-gray-500 text-sm mb-5">Team assignment override</p>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchData(password)}
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          {authError && <p className="text-red-500 text-sm mb-3">{authError}</p>}
          <button
            onClick={() => fetchData(password)}
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-700 transition disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin: Team Assignments</h1>
            <p className="text-gray-500 text-sm">
              Assign teams to each player. This replaces all existing assignments.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : '🔄 Sync Scores'}
            </button>
            <button
              onClick={handleSyncSeason}
              disabled={syncing}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : '📅 Sync Full Season'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-nfl-navy text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-900 transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Assignments'}
            </button>
          </div>
        </div>

        {syncMsg && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            syncMsg.startsWith('✓')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {syncMsg}
          </div>
        )}

        {saveMsg && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            saveMsg.startsWith('✓')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {saveMsg}
          </div>
        )}

        {/* Player slots */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {data?.users.map((user) => (
            <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="font-semibold text-gray-900 mb-3">{user.display_name}</div>
              <div className="text-xs text-gray-400 mb-2">{user.email}</div>
              <div className="space-y-2">
                {[0, 1, 2, 3].map((pickIdx) => {
                  const teamId = draftMap[user.id]?.[pickIdx] || 0
                  const team = data.teams.find((t) => t.id === teamId)
                  return (
                    <div key={pickIdx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-10">Pick {pickIdx + 1}</span>
                      <select
                        value={teamId || ''}
                        onChange={(e) => assignTeam(user.id, pickIdx, Number(e.target.value))}
                        className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nfl-navy"
                      >
                        <option value="">— unassigned —</option>
                        {team && (
                          <option value={team.id}>{team.full_name}</option>
                        )}
                        {data.teams
                          .filter((t) => !assignedTeamIds.has(t.id) || t.id === teamId)
                          .sort((a, b) => a.full_name.localeCompare(b.full_name))
                          .filter((t) => t.id !== teamId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>{t.full_name}</option>
                          ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Unassigned teams pool */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">
            Unassigned Teams ({unassignedTeams.length})
          </h2>
          {unassignedTeams.length === 0 ? (
            <p className="text-green-600 text-sm">All 32 teams assigned ✓</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unassignedTeams.map((team) => (
                <span
                  key={team.id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: team.primary_color || '#013369' }}
                >
                  {team.abbreviation}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* User accounts */}
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-1">User Accounts</h2>
          <p className="text-gray-400 text-xs mb-3">
            All users log in with password: <code className="bg-gray-100 px-1 rounded">NFLPool2026!</code> (set during seed — update in Supabase Auth if needed)
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 font-medium">{u.display_name}</td>
                  <td className="py-2 text-gray-500">{u.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}