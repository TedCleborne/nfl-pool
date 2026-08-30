# NFL Pool — Setup Guide

## Prerequisites
- Node.js 18+ installed
- Git installed
- A GitHub account (for Vercel deployment)

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up / log in
2. Click **New Project** — name it `nfl-pool`, choose any region
3. Once created, go to **Settings → API** and copy:
   - **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → this is your `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

4. Go to **SQL Editor** and paste + run the contents of `supabase/schema.sql`

---

## Step 2: Get an Odds API Key

1. Go to [the-odds-api.com](https://the-odds-api.com) and sign up for a free account
2. Copy your API key from the dashboard
3. Free tier = 500 requests/month — more than enough for the NFL season

---

## Step 3: Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_URL=https://your-project.supabase.co   # same as above
ODDS_API_KEY=your-odds-api-key
ADMIN_PASSWORD=pick-something-secure
CRON_SECRET=pick-a-random-string-for-the-sync-job
```

---

## Step 4: Install Dependencies and Run the Seed Script

```bash
npm install
npm run seed
```

This will:
- Pull all 32 NFL teams from ESPN and insert them into the database
- Create 8 test user accounts (ted.cleborne+1 through +8 @gmail.com)
- Randomly assign 4 teams to each user

**All test users share the same password:** `NFLPool2026!`

After your real draft, use the `/admin` page to reassign teams.

---

## Step 5: Run Locally to Test

```bash
npm run dev
```

Open http://localhost:3000 and log in with:
- Email: `ted.cleborne+1@gmail.com`
- Password: `NFLPool2026!`

---

## Step 6: Deploy to Vercel

1. Push this folder to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial NFL pool"
   git remote add origin https://github.com/YOUR_USERNAME/nfl-pool.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com), click **Add New → Project**, and import your GitHub repo

3. In Vercel's project settings, go to **Environment Variables** and add all the same values from your `.env.local`

4. Click **Deploy**

5. The `vercel.json` file sets up a cron job that automatically syncs scores every 30 minutes during game days. On Vercel's free Hobby plan, crons run every hour minimum; upgrade to Pro for 30-minute intervals.

---

## Step 7: After the Real Draft — Update Team Assignments

1. Go to `https://your-app.vercel.app/admin`
2. Enter your `ADMIN_PASSWORD`
3. Use the dropdowns to reassign all 32 teams to the correct owners
4. Click **Save Assignments**

---

## Step 8: Share Login Links

Give each player their email and the password `NFLPool2026!`. They log in at your Vercel URL.

To update the real display names (e.g. "Ted" → real first names), either:
- Edit `scripts/seed.ts` before running it, or
- Update the `league_users` table directly in the Supabase dashboard (Table Editor)

To update passwords, use the Supabase dashboard → Authentication → Users → edit user.

---

## Ongoing: Keeping Scores Fresh

The Vercel cron job hits `/api/sync-games` every hour automatically. On active game days, you can also hit it manually at any time:

```
POST https://your-app.vercel.app/api/sync-games
Authorization: Bearer YOUR_CRON_SECRET
```

Or, in development only, open http://localhost:3000/api/sync-games in your browser (GET works in dev).

---

## Scoring Reference

| Outcome | Points |
|---|---|
| Win (regular season) | +1 |
| Win as >3.5 pt underdog (regular season) | +2 |
| Win as >3.5 pt underdog (playoffs) | +3 |
| Tie (regular season only) | −1 |
| Loss | 0 |
| Double-points week (reg season) | All points × 2 |

Each pool member designates one double-points week per team, anytime before kickoff. It locks automatically when the game starts.
