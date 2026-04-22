
-- ============================================================
-- 1. NEW TABLES: mastery, burn_list, daily totals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  subject text,
  attempts int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  mastery_pct int NOT NULL DEFAULT 0,
  last_practiced_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic)
);

ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own mastery" ON public.topic_mastery
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own mastery" ON public.topic_mastery
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own mastery" ON public.topic_mastery
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own mastery" ON public.topic_mastery
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER topic_mastery_set_updated_at
  BEFORE UPDATE ON public.topic_mastery
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Burn list: questions the student got wrong, for re-quizzing
CREATE TABLE IF NOT EXISTS public.burn_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text,
  question text NOT NULL,
  expected_answer text NOT NULL,
  user_answer text,
  times_wrong int NOT NULL DEFAULT 1,
  last_wrong_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.burn_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own burn" ON public.burn_list
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own burn" ON public.burn_list
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own burn" ON public.burn_list
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own burn" ON public.burn_list
  FOR DELETE USING (auth.uid() = user_id);

-- Add daily XP total tracking (in addition to levels_gained)
ALTER TABLE public.daily_xp_progress
  ADD COLUMN IF NOT EXISTS xp_gained int NOT NULL DEFAULT 0;

-- Add buff usage daily counter
CREATE TABLE IF NOT EXISTS public.daily_buff_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.daily_buff_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own buff usage S" ON public.daily_buff_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Own buff usage I" ON public.daily_buff_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own buff usage U" ON public.daily_buff_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 2. HARDENED BUFF ACTIVATION FUNCTION
--    - Adds DAILY USAGE CAP (max 8 buff activations per day)
--    - Enforces 1000 XP/day cap on instant buffs
--    - Keeps 4s cooldown + 10 min study + max 3 active
-- ============================================================
CREATE OR REPLACE FUNCTION public.activate_inventory_buff(_buff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item public.inventory%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_meta jsonb;
  v_now timestamptz := now();
  v_last timestamptz;
  v_study_minutes integer := 0;
  v_live_count integer := 0;
  v_duration integer := 0;
  v_multiplier numeric := 1;
  v_category text := 'xp';
  v_label text := '';
  v_xp integer := 0;
  v_new_xp integer := 0;
  v_new_level integer := 1;
  v_old_level integer := 1;
  v_levels_today integer := 0;
  v_xp_today integer := 0;
  v_buffs_today integer := 0;
  v_today date := (now() at time zone 'utc')::date;
  v_last_active date;
  v_new_streak integer := 0;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
  v_remaining_xp integer;
  v_award integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_item
  FROM public.inventory
  WHERE id = _buff_id AND user_id = auth.uid() AND item_type = 'buff'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That buff is no longer available';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  -- 4-second cooldown
  v_last := v_profile.last_buff_activated_at;
  IF v_last IS NOT NULL AND v_last > (v_now - interval '4 seconds') THEN
    RAISE EXCEPTION 'Wait 4 seconds before activating another buff';
  END IF;

  -- 10 minutes of study since last buff
  SELECT COALESCE(SUM(duration_minutes), 0)::integer INTO v_study_minutes
  FROM public.focus_sessions
  WHERE user_id = auth.uid() AND completed_at > COALESCE(v_last, '-infinity'::timestamptz);

  IF v_study_minutes < 10 THEN
    RAISE EXCEPTION 'Study for at least 10 minutes (focus session) before using another buff';
  END IF;

  -- Daily buff usage cap (max 8/day to prevent stacking abuse)
  SELECT COALESCE(count, 0) INTO v_buffs_today
  FROM public.daily_buff_usage
  WHERE user_id = auth.uid() AND day = v_today;
  IF v_buffs_today >= 8 THEN
    RAISE EXCEPTION 'Daily buff limit reached (8/day). Try again tomorrow';
  END IF;

  v_meta := COALESCE(v_item.metadata, '{}'::jsonb);
  v_duration := GREATEST(COALESCE((v_meta->>'durationMin')::integer, 0), 0);
  v_multiplier := GREATEST(COALESCE((v_meta->>'multiplier')::numeric, 1), 0);
  v_category := COALESCE(NULLIF(v_meta->>'category', ''), 'xp');
  v_label := COALESCE(NULLIF(v_meta->>'label', ''), v_item.item_key);
  v_xp := GREATEST(COALESCE((v_meta->>'xpAmount')::integer, 0), 0);

  -- INSTANT XP buff
  IF COALESCE((v_meta->>'instant')::boolean, false) AND v_xp > 0 THEN
    v_old_level := COALESCE(v_profile.level, 1);

    -- Daily XP cap = 1000 (~10 levels)
    SELECT COALESCE(xp_gained, 0), COALESCE(levels_gained, 0)
      INTO v_xp_today, v_levels_today
    FROM public.daily_xp_progress
    WHERE user_id = auth.uid() AND day = v_today;

    v_remaining_xp := GREATEST(0, 1000 - v_xp_today);
    v_award := LEAST(v_xp, v_remaining_xp);

    IF v_award <= 0 THEN
      -- Still consume the buff but no XP gain
      DELETE FROM public.inventory WHERE id = v_item.id;
      INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
        VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
        ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
      UPDATE public.profiles SET last_buff_activated_at = v_now, updated_at = now() WHERE user_id = auth.uid();
      RETURN jsonb_build_object(
        'kind', 'capped',
        'message', 'Daily XP cap reached (1000 XP/day). Buff used but no XP awarded.',
        'label', v_label,
        'rarity', v_item.rarity,
        'buffKey', v_item.item_key
      );
    END IF;

    v_new_xp := GREATEST(0, COALESCE(v_profile.xp, 0) + v_award);
    v_new_level := public.level_from_xp(v_new_xp);
    v_last_active := v_profile.last_active_date;
    v_new_streak := COALESCE(v_profile.streak, 0);

    IF v_last_active IS DISTINCT FROM v_today THEN
      IF v_last_active = v_yesterday THEN v_new_streak := v_new_streak + 1;
      ELSE v_new_streak := 1; END IF;
    END IF;

    UPDATE public.profiles
    SET xp = v_new_xp, level = v_new_level, streak = v_new_streak,
        last_active_date = v_today, last_buff_activated_at = v_now, updated_at = now()
    WHERE user_id = auth.uid();

    INSERT INTO public.daily_xp_progress (user_id, day, levels_gained, xp_gained, updated_at)
      VALUES (auth.uid(), v_today, GREATEST(0, v_new_level - v_old_level), v_xp_today + v_award, now())
      ON CONFLICT (user_id, day) DO UPDATE
        SET levels_gained = public.daily_xp_progress.levels_gained + GREATEST(0, v_new_level - v_old_level),
            xp_gained = public.daily_xp_progress.xp_gained + v_award,
            updated_at = now();

    INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
      VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
      ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();

    PERFORM public.refresh_weekly_score(auth.uid());
    DELETE FROM public.inventory WHERE id = v_item.id;

    RETURN jsonb_build_object(
      'kind', 'instant',
      'message', format('+%s XP instantly!', v_award),
      'label', v_label,
      'xpAward', v_award,
      'rarity', v_item.rarity,
      'buffKey', v_item.item_key
    );
  END IF;

  -- TIME WARP
  IF v_item.item_key = 'time_warp' THEN
    UPDATE public.active_buffs
    SET expires_at = CASE WHEN expires_at IS NULL THEN NULL
                          ELSE (v_now + ((expires_at - v_now) * 1.5)) END
    WHERE user_id = auth.uid() AND expires_at IS NOT NULL AND expires_at > v_now;

    UPDATE public.profiles SET last_buff_activated_at = v_now, updated_at = now() WHERE user_id = auth.uid();
    INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
      VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
      ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
    DELETE FROM public.inventory WHERE id = v_item.id;

    RETURN jsonb_build_object('kind', 'time_warp', 'message', 'Time Warp activated', 'label', v_label, 'rarity', v_item.rarity, 'buffKey', v_item.item_key);
  END IF;

  -- ACTIVE BUFF
  SELECT COUNT(*) INTO v_live_count FROM public.active_buffs
  WHERE user_id = auth.uid() AND (expires_at IS NULL OR expires_at > v_now);

  IF v_live_count >= 3 THEN
    RAISE EXCEPTION 'Max 3 active buffs. Wait for one to expire';
  END IF;

  INSERT INTO public.active_buffs (user_id, buff_key, rarity, multiplier, category, expires_at)
  VALUES (auth.uid(), v_item.item_key, v_item.rarity, v_multiplier, v_category,
    CASE WHEN v_duration > 0 THEN v_now + make_interval(mins => v_duration) ELSE NULL END);

  UPDATE public.profiles SET last_buff_activated_at = v_now, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO public.daily_buff_usage (user_id, day, count, updated_at)
    VALUES (auth.uid(), v_today, v_buffs_today + 1, now())
    ON CONFLICT (user_id, day) DO UPDATE SET count = public.daily_buff_usage.count + 1, updated_at = now();
  DELETE FROM public.inventory WHERE id = v_item.id;

  RETURN jsonb_build_object('kind', 'active', 'message', format('%s activated', v_label),
    'label', v_label, 'rarity', v_item.rarity, 'buffKey', v_item.item_key,
    'multiplier', v_multiplier, 'category', v_category,
    'expiresAt', CASE WHEN v_duration > 0 THEN (v_now + make_interval(mins => v_duration)) ELSE NULL END);
END;
$$;

-- ============================================================
-- 3. RESET EVERYONE > LEVEL 5 BACK TO LEVEL 5, REMOVE BUFFS
-- ============================================================
UPDATE public.profiles
SET xp = 500, level = 5, updated_at = now()
WHERE level > 5 OR xp > 500;

DELETE FROM public.active_buffs;

-- ============================================================
-- 4. GIVE EVERYONE 3 PACKS
-- ============================================================
INSERT INTO public.inventory (user_id, item_type, item_key, rarity, metadata)
SELECT user_id, 'pack', 'buff_pack',
  (ARRAY['common','rare','epic'])[floor(random() * 3 + 1)::int],
  jsonb_build_object('opened', false, 'gift', true)
FROM public.profiles;

INSERT INTO public.inventory (user_id, item_type, item_key, rarity, metadata)
SELECT user_id, 'pack', 'buff_pack', 'rare', jsonb_build_object('opened', false, 'gift', true)
FROM public.profiles;

INSERT INTO public.inventory (user_id, item_type, item_key, rarity, metadata)
SELECT user_id, 'pack', 'buff_pack', 'common', jsonb_build_object('opened', false, 'gift', true)
FROM public.profiles;
