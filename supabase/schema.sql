-- ============================================================
-- NFL Pick Em Pool — Supabase Schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension (usually already enabled on Supabase)
create extension if not exists "uuid-ossp";

-- ─── NFL Teams ───────────────────────────────────────────────
create table if not exists nfl_teams (
  id          serial primary key,
  espn_id     text unique not null,
  name        text not null,
  abbreviation text not null,
  city        text not null,
  full_name   text not null,
  conference  text,
  division    text,
  logo_url    text,
  primary_color text default '#013369'
);

-- ─── League Users (extends Supabase auth.users) ──────────────
create table if not exists league_users (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email        text not null unique
);

-- ─── Team Assignments (draft results) ────────────────────────
create table if not exists team_assignments (
  id          serial primary key,
  user_id     uuid not null references league_users(id) on delete cascade,
  team_id     integer not null references nfl_teams(id),
  draft_pick  integer,             -- 1–4 for each user
  unique(team_id),                 -- each NFL team belongs to exactly one pool member
  unique(user_id, draft_pick)
);

-- ─── NFL Games (populated by sync-games API route) ───────────
create table if not exists nfl_games (
  id              text primary key,  -- ESPN game ID
  season          integer not null,
  week            integer not null,
  season_type     integer not null default 2,  -- 2 = regular, 3 = postseason
  is_playoff      boolean not null default false,
  playoff_round   text,              -- 'wildcard' | 'divisional' | 'championship' | 'superbowl'
  home_team_id    integer references nfl_teams(id),
  away_team_id    integer references nfl_teams(id),
  home_score      integer,
  away_score      integer,
  status          text not null default 'scheduled',  -- 'scheduled' | 'in_progress' | 'final'
  kickoff_time    timestamptz not null,
  -- Spread: from home team perspective. Negative = home is favorite.
  -- e.g. home_spread = -3.5 means home team is favored by 3.5 points
  home_spread     numeric(5,1),
  spread_locked   boolean not null default false,
  updated_at      timestamptz default now()
);

create index if not exists idx_nfl_games_season_week on nfl_games(season, week);
create index if not exists idx_nfl_games_status on nfl_games(status);

-- ─── Double Points Designations ──────────────────────────────
create table if not exists double_points_weeks (
  id          serial primary key,
  user_id     uuid not null references league_users(id) on delete cascade,
  team_id     integer not null references nfl_teams(id),
  week        integer not null,
  season      integer not null,
  locked      boolean not null default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, team_id)           -- one designation per team per user, per season
);

-- ─── Row Level Security ───────────────────────────────────────
alter table league_users enable row level security;
alter table team_assignments enable row level security;
alter table nfl_teams enable row level security;
alter table nfl_games enable row level security;
alter table double_points_weeks enable row level security;

-- league_users: users can read all, only write their own row
create policy "Anyone can read league_users"
  on league_users for select using (true);

create policy "Users can update their own row"
  on league_users for update using (auth.uid() = id);

-- team_assignments: everyone can read, service role writes
create policy "Anyone can read team_assignments"
  on team_assignments for select using (true);

-- nfl_teams: public read
create policy "Anyone can read nfl_teams"
  on nfl_teams for select using (true);

-- nfl_games: public read
create policy "Anyone can read nfl_games"
  on nfl_games for select using (true);

-- double_points_weeks: read all, write own and only if not locked
create policy "Anyone can read double_points_weeks"
  on double_points_weeks for select using (true);

create policy "Users can insert their own double points week"
  on double_points_weeks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own unlocked double points week"
  on double_points_weeks for update
  using (auth.uid() = user_id and locked = false);

create policy "Users can delete their own unlocked double points week"
  on double_points_weeks for delete
  using (auth.uid() = user_id and locked = false);

-- ─── Helper: updated_at trigger ──────────────────────────────
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_nfl_games_updated_at
  before update on nfl_games
  for each row execute function update_updated_at_column();

create trigger update_double_points_weeks_updated_at
  before update on double_points_weeks
  for each row execute function update_updated_at_column();
