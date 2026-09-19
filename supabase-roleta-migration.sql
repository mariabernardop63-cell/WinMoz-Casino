-- Roleta spins table for weekly free spin tracking
-- Required by api/roleta.ts backend

CREATE TABLE IF NOT EXISTS roleta_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,           -- e.g. "2026-W38"
  spin_number INTEGER NOT NULL,     -- 1, 2, or 3
  prize NUMERIC(10,2) NOT NULL DEFAULT 0,
  won_5mt BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One spin per user per spin_number per week
  UNIQUE(user_id, week_key, spin_number)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_roleta_spins_user_week ON roleta_spins(user_id, week_key);
CREATE INDEX IF NOT EXISTS idx_roleta_spins_week_budget ON roleta_spins(week_key, won_5mt);

-- RLS: users can only read their own spins
ALTER TABLE roleta_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roleta spins"
  ON roleta_spins FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (backend) can do everything
CREATE POLICY "Service role full access on roleta spins"
  ON roleta_spins FOR ALL
  USING (true)
  WITH CHECK (true);
