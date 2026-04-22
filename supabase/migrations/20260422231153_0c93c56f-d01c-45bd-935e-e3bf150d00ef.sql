ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_buff_activated_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS public.chat_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chat_kind TEXT NOT NULL,
  chat_id UUID NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_kind, chat_id)
);

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_reads' AND policyname = 'Users read own chat markers'
  ) THEN
    CREATE POLICY "Users read own chat markers"
    ON public.chat_reads
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_reads' AND policyname = 'Users create own chat markers'
  ) THEN
    CREATE POLICY "Users create own chat markers"
    ON public.chat_reads
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_reads' AND policyname = 'Users update own chat markers'
  ) THEN
    CREATE POLICY "Users update own chat markers"
    ON public.chat_reads
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_reads' AND policyname = 'Users delete own chat markers'
  ) THEN
    CREATE POLICY "Users delete own chat markers"
    ON public.chat_reads
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.study_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_notes' AND policyname = 'Users view own study notes'
  ) THEN
    CREATE POLICY "Users view own study notes"
    ON public.study_notes
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_notes' AND policyname = 'Users create own study notes'
  ) THEN
    CREATE POLICY "Users create own study notes"
    ON public.study_notes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_notes' AND policyname = 'Users edit own study notes'
  ) THEN
    CREATE POLICY "Users edit own study notes"
    ON public.study_notes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_notes' AND policyname = 'Users delete own study notes'
  ) THEN
    CREATE POLICY "Users delete own study notes"
    ON public.study_notes
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_study_notes_updated_at ON public.study_notes;
CREATE TRIGGER update_study_notes_updated_at
BEFORE UPDATE ON public.study_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.study_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_resources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_resources' AND policyname = 'Users view own study resources'
  ) THEN
    CREATE POLICY "Users view own study resources"
    ON public.study_resources
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_resources' AND policyname = 'Users create own study resources'
  ) THEN
    CREATE POLICY "Users create own study resources"
    ON public.study_resources
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_resources' AND policyname = 'Users edit own study resources'
  ) THEN
    CREATE POLICY "Users edit own study resources"
    ON public.study_resources
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'study_resources' AND policyname = 'Users delete own study resources'
  ) THEN
    CREATE POLICY "Users delete own study resources"
    ON public.study_resources
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_study_resources_updated_at ON public.study_resources;
CREATE TRIGGER update_study_resources_updated_at
BEFORE UPDATE ON public.study_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcard_decks' AND policyname = 'Users view own flashcard decks'
  ) THEN
    CREATE POLICY "Users view own flashcard decks"
    ON public.flashcard_decks
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcard_decks' AND policyname = 'Users create own flashcard decks'
  ) THEN
    CREATE POLICY "Users create own flashcard decks"
    ON public.flashcard_decks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcard_decks' AND policyname = 'Users edit own flashcard decks'
  ) THEN
    CREATE POLICY "Users edit own flashcard decks"
    ON public.flashcard_decks
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcard_decks' AND policyname = 'Users delete own flashcard decks'
  ) THEN
    CREATE POLICY "Users delete own flashcard decks"
    ON public.flashcard_decks
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_flashcard_decks_updated_at ON public.flashcard_decks;
CREATE TRIGGER update_flashcard_decks_updated_at
BEFORE UPDATE ON public.flashcard_decks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  next_review_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  review_interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  last_result TEXT,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcards' AND policyname = 'Users view own flashcards'
  ) THEN
    CREATE POLICY "Users view own flashcards"
    ON public.flashcards
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcards' AND policyname = 'Users create own flashcards'
  ) THEN
    CREATE POLICY "Users create own flashcards"
    ON public.flashcards
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcards' AND policyname = 'Users edit own flashcards'
  ) THEN
    CREATE POLICY "Users edit own flashcards"
    ON public.flashcards
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'flashcards' AND policyname = 'Users delete own flashcards'
  ) THEN
    CREATE POLICY "Users delete own flashcards"
    ON public.flashcards
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_flashcards_updated_at ON public.flashcards;
CREATE TRIGGER update_flashcards_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('study-resources', 'study-resources', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users view own study resources files'
  ) THEN
    CREATE POLICY "Users view own study resources files"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'study-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users upload own study resources files'
  ) THEN
    CREATE POLICY "Users upload own study resources files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'study-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users update own study resources files'
  ) THEN
    CREATE POLICY "Users update own study resources files"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'study-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users delete own study resources files'
  ) THEN
    CREATE POLICY "Users delete own study resources files"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'study-resources' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.activate_inventory_buff(_buff_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_today date := (now() at time zone 'utc')::date;
  v_last_active date;
  v_new_streak integer := 0;
  v_yesterday date := ((now() at time zone 'utc')::date - interval '1 day')::date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_item
  FROM public.inventory
  WHERE id = _buff_id
    AND user_id = auth.uid()
    AND item_type = 'buff'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That buff is no longer available';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_last := v_profile.last_buff_activated_at;
  IF v_last IS NOT NULL AND v_last > (v_now - interval '4 seconds') THEN
    RAISE EXCEPTION 'Wait 4 seconds before activating another buff';
  END IF;

  SELECT COALESCE(SUM(duration_minutes), 0)::integer INTO v_study_minutes
  FROM public.focus_sessions
  WHERE user_id = auth.uid()
    AND completed_at > COALESCE(v_last, '-infinity'::timestamptz);

  IF v_study_minutes < 10 THEN
    RAISE EXCEPTION 'Study for at least 10 minutes before using another buff';
  END IF;

  v_meta := COALESCE(v_item.metadata, '{}'::jsonb);
  v_duration := GREATEST(COALESCE((v_meta->>'durationMin')::integer, 0), 0);
  v_multiplier := GREATEST(COALESCE((v_meta->>'multiplier')::numeric, 1), 0);
  v_category := COALESCE(NULLIF(v_meta->>'category', ''), 'xp');
  v_label := COALESCE(NULLIF(v_meta->>'label', ''), v_item.item_key);
  v_xp := GREATEST(COALESCE((v_meta->>'xpAmount')::integer, 0), 0);

  IF COALESCE((v_meta->>'instant')::boolean, false) AND v_xp > 0 THEN
    v_old_level := COALESCE(v_profile.level, 1);
    v_new_xp := GREATEST(0, COALESCE(v_profile.xp, 0) + v_xp);
    v_new_level := public.level_from_xp(v_new_xp);
    v_last_active := v_profile.last_active_date;
    v_new_streak := COALESCE(v_profile.streak, 0);

    IF v_last_active IS DISTINCT FROM v_today THEN
      IF v_last_active = v_yesterday THEN
        v_new_streak := v_new_streak + 1;
      ELSE
        v_new_streak := 1;
      END IF;
    END IF;

    SELECT COALESCE(levels_gained, 0) INTO v_levels_today
    FROM public.daily_xp_progress
    WHERE user_id = auth.uid() AND day = v_today;

    UPDATE public.profiles
    SET xp = v_new_xp,
        level = v_new_level,
        streak = v_new_streak,
        last_active_date = v_today,
        last_buff_activated_at = v_now,
        updated_at = now()
    WHERE user_id = auth.uid();

    IF v_new_level > v_old_level THEN
      INSERT INTO public.daily_xp_progress (user_id, day, levels_gained, updated_at)
      VALUES (auth.uid(), v_today, v_levels_today + (v_new_level - v_old_level), now())
      ON CONFLICT (user_id, day)
      DO UPDATE SET levels_gained = public.daily_xp_progress.levels_gained + EXCLUDED.levels_gained,
                    updated_at = now();
    END IF;

    PERFORM public.refresh_weekly_score(auth.uid());
    DELETE FROM public.inventory WHERE id = v_item.id;

    RETURN jsonb_build_object(
      'kind', 'instant',
      'message', format('+%s XP instantly!', v_xp),
      'label', v_label,
      'xpAward', v_xp,
      'rarity', v_item.rarity,
      'buffKey', v_item.item_key
    );
  END IF;

  IF v_item.item_key = 'time_warp' THEN
    UPDATE public.active_buffs
    SET expires_at = CASE
      WHEN expires_at IS NULL THEN NULL
      ELSE (v_now + ((expires_at - v_now) * 1.5))
    END
    WHERE user_id = auth.uid()
      AND expires_at IS NOT NULL
      AND expires_at > v_now;

    UPDATE public.profiles
    SET last_buff_activated_at = v_now,
        updated_at = now()
    WHERE user_id = auth.uid();

    DELETE FROM public.inventory WHERE id = v_item.id;

    RETURN jsonb_build_object(
      'kind', 'time_warp',
      'message', 'Time Warp activated',
      'label', v_label,
      'rarity', v_item.rarity,
      'buffKey', v_item.item_key
    );
  END IF;

  SELECT COUNT(*) INTO v_live_count
  FROM public.active_buffs
  WHERE user_id = auth.uid()
    AND (expires_at IS NULL OR expires_at > v_now);

  IF v_live_count >= 3 THEN
    RAISE EXCEPTION 'Max 3 active buffs. Wait for one to expire';
  END IF;

  INSERT INTO public.active_buffs (user_id, buff_key, rarity, multiplier, category, expires_at)
  VALUES (
    auth.uid(),
    v_item.item_key,
    v_item.rarity,
    v_multiplier,
    v_category,
    CASE WHEN v_duration > 0 THEN v_now + make_interval(mins => v_duration) ELSE NULL END
  );

  UPDATE public.profiles
  SET last_buff_activated_at = v_now,
      updated_at = now()
  WHERE user_id = auth.uid();

  DELETE FROM public.inventory WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'kind', 'active',
    'message', format('%s activated', v_label),
    'label', v_label,
    'rarity', v_item.rarity,
    'buffKey', v_item.item_key,
    'multiplier', v_multiplier,
    'category', v_category,
    'expiresAt', CASE WHEN v_duration > 0 THEN (v_now + make_interval(mins => v_duration)) ELSE NULL END
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.activate_inventory_buff(uuid) TO authenticated;

ALTER TABLE public.chat_reads REPLICA IDENTITY FULL;
ALTER TABLE public.study_notes REPLICA IDENTITY FULL;
ALTER TABLE public.study_resources REPLICA IDENTITY FULL;
ALTER TABLE public.flashcards REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.dm_chats REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_notes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_resources;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcards;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_chats;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;