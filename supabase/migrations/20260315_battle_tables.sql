-- Squad Battles: challenges + matches tables

CREATE TABLE challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES auth.users,
  challenged_id uuid NOT NULL REFERENCES auth.users,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  challenger_squad jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES challenges,
  challenger_id uuid NOT NULL REFERENCES auth.users,
  challenged_id uuid NOT NULL REFERENCES auth.users,
  challenger_squad jsonb NOT NULL,
  challenged_squad jsonb NOT NULL,
  match_seed text NOT NULL,
  events jsonb NOT NULL,
  score_home int NOT NULL DEFAULT 0,
  score_away int NOT NULL DEFAULT 0,
  result text NOT NULL CHECK (result IN ('home_win', 'away_win', 'draw')),
  coins_awarded_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  played_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY challenges_select ON challenges FOR SELECT
  USING (auth.uid() IN (challenger_id, challenged_id));

CREATE POLICY challenges_insert ON challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY challenges_update ON challenges FOR UPDATE
  USING (auth.uid() IN (challenger_id, challenged_id));

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select ON matches FOR SELECT
  USING (auth.uid() IN (challenger_id, challenged_id));

CREATE POLICY matches_insert ON matches FOR INSERT
  WITH CHECK (auth.uid() = challenged_id);

-- Indexes for common queries
CREATE INDEX idx_challenges_challenger ON challenges (challenger_id, status);
CREATE INDEX idx_challenges_challenged ON challenges (challenged_id, status);
CREATE INDEX idx_matches_challenger ON matches (challenger_id, played_at DESC);
CREATE INDEX idx_matches_challenged ON matches (challenged_id, played_at DESC);
