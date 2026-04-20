
-- Track daily streak-pack grants (one row per user per day they got streak packs)
CREATE TABLE IF NOT EXISTS public.daily_pack_grants (
  user_id UUID NOT NULL,
  day DATE NOT NULL,
  packs_granted INT NOT NULL DEFAULT 0,
  milestone_streak INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.daily_pack_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grants S" ON public.daily_pack_grants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own grants I" ON public.daily_pack_grants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own grants U" ON public.daily_pack_grants FOR UPDATE USING (auth.uid() = user_id);

-- Allow message deletion by the author (or group creator if needed later)
CREATE POLICY "Authors can delete own messages"
  ON public.messages FOR DELETE
  USING (auth.uid() = user_id);

-- AI study history: log every tutor/practice/test interaction for analytics
CREATE TABLE IF NOT EXISTS public.ai_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL, -- 'tutor' | 'practice' | 'test' | 'image'
  topic TEXT,
  prompt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { score, total, difficulty }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_history S" ON public.ai_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own ai_history I" ON public.ai_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_history_user_created ON public.ai_history (user_id, created_at DESC);
