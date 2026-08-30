export interface LeagueUser {
  id: string
  display_name: string
  email: string
}

export interface NflTeam {
  id: number
  name: string
  abbreviation: string
  city: string
  full_name: string
  conference: string
  division: string
  logo_url?: string
  primary_color: string
}

export interface TeamAssignment {
  id: number
  user_id: string
  team_id: number
  draft_pick: number
  nfl_teams?: NflTeam
  league_users?: LeagueUser
}

export interface NflGame {
  id: string
  season: number
  week: number
  is_playoff: boolean
  playoff_round?: string // 'wildcard' | 'divisional' | 'championship' | 'superbowl'
  home_team_id: number
  away_team_id: number
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'in_progress' | 'final'
  kickoff_time: string
  home_spread: number | null  // negative = home favored (e.g. -3.5 means home is 3.5 pt favorite)
  spread_locked: boolean
  home_team?: NflTeam
  away_team?: NflTeam
}

export interface DoublePointsWeek {
  id: number
  user_id: string
  team_id: number
  week: number
  season: number
  locked: boolean
}

export interface UserStanding {
  user_id: string
  display_name: string
  total_points: number
  wins: number
  losses: number
  ties: number
  underdog_wins: number
  teams: TeamWithPoints[]
}

export interface TeamWithPoints {
  team: NflTeam
  points: number
  wins: number
  losses: number
  ties: number
  double_points_week: number | null
  games: GameResult[]
}

export interface GameResult {
  game: NflGame
  points: number
  is_double_points_week: boolean
  opponent: NflTeam
  team_score: number | null
  opponent_score: number | null
}
