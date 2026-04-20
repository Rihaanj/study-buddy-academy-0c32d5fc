-- Weekly score tracker (one row per user per week)
CREATE TABLE public.weekly_scores (
  user_id UUID NOT NULL,
  week_start DATE NOT NULL, -- Monday of the week (UTC)
  xp_start INTEGER NOT NULL DEFAULT 0,        -- profile.xp at week start
  focus_start INTEGER NOT NULL DEFAULT 0,     -- total focus minutes at week start
  xp_delta INTEGER NOT NULL DEFAULT 0,        -- xp earned this week (cached, recomputed)
  focus_delta INTEGER NOT NULL DEFAULT 0,     -- focus minutes this week (cached, recomputed)
  score NUMERIC NOT NULL DEFAULT 0,           -- xp_delta + focus_delta * 2
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

ALTER TABLE public.weekly_scores ENABLE ROW LEVEL SECURITY;

-- Friends + self can view scores (so leaderboard works)
CREATE POLICY "View own or friend weekly scores"
  ON public.weekly_scores FOR SELECT
  USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));

CREATE POLICY "Users insert own weekly scores"
  ON public.weekly_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own weekly scores"
  ON public.weekly_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_weekly_scores_week ON public.weekly_scores(week_start);

-- Track who got winner/loser pack rewards each week per friend circle (so we don't double-grant)
CREATE TABLE public.weekly_leaderboard_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  reward_type TEXT NOT NULL, -- 'winner' (10 packs) or 'loser' (5 packs)
  packs_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_leaderboard_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own rewards"
  ON public.weekly_leaderboard_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- Helper: ISO Monday of any date
CREATE OR REPLACE FUNCTION public.iso_monday(_d DATE)
RETURNS DATE
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT (_d - ((EXTRACT(ISODOW FROM _d)::int - 1)))::date;
$$;

-- Initialize / fetch current week's score row for a user
CREATE OR REPLACE FUNCTION public.ensure_weekly_score(_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wk DATE := public.iso_monday((now() AT TIME ZONE 'UTC')::date);
  current_xp INT;
  current_focus INT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.weekly_scores WHERE user_id = _user_id AND week_start = wk) THEN
    RETURN;
  END IF;
  SELECT COALESCE(xp,0) INTO current_xp FROM public.profiles WHERE user_id = _user_id;
  SELECT COALESCE(SUM(duration_minutes),0)::int INTO current_focus FROM public.focus_sessions WHERE user_id = _user_id;
  INSERT INTO public.weekly_scores (user_id, week_start, xp_start, focus_start, xp_delta, focus_delta, score)
  VALUES (_user_id, wk, COALESCE(current_xp,0), COALESCE(current_focus,0), 0, 0, 0)
  ON CONFLICT (user_id, week_start) DO NOTHING;
END;
$$;

-- Recompute current week's deltas + score from current totals
CREATE OR REPLACE FUNCTION public.refresh_weekly_score(_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wk DATE := public.iso_monday((now() AT TIME ZONE 'UTC')::date);
  current_xp INT;
  current_focus INT;
BEGIN
  PERFORM public.ensure_weekly_score(_user_id);
  SELECT COALESCE(xp,0) INTO current_xp FROM public.profiles WHERE user_id = _user_id;
  SELECT COALESCE(SUM(duration_minutes),0)::int INTO current_focus FROM public.focus_sessions WHERE user_id = _user_id;
  UPDATE public.weekly_scores
  SET xp_delta = GREATEST(0, COALESCE(current_xp,0) - xp_start),
      focus_delta = GREATEST(0, COALESCE(current_focus,0) - focus_start),
      score = GREATEST(0, COALESCE(current_xp,0) - xp_start) + GREATEST(0, COALESCE(current_focus,0) - focus_start) * 2,
      updated_at = now()
  WHERE user_id = _user_id AND week_start = wk;
END;
$$;