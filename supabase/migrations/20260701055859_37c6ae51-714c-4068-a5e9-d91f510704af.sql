
-- Grade level on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grade_level TEXT;

-- Lessons table
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  example TEXT NOT NULL DEFAULT '',
  key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  mistakes JSONB NOT NULL DEFAULT '[]'::jsonb,
  youtube_videos JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  quiz JSONB NOT NULL DEFAULT '[]'::jsonb,
  flashcards JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_topic TEXT NOT NULL DEFAULT '',
  grade_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lessons_select_own" ON public.lessons
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lessons_insert_own" ON public.lessons
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lessons_update_own" ON public.lessons
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lessons_delete_own" ON public.lessons
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS lessons_user_created_idx
  ON public.lessons (user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_lessons_updated_at ON public.lessons;
CREATE TRIGGER trg_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
