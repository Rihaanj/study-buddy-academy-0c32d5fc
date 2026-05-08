
CREATE TABLE IF NOT EXISTS public.grade_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7c3aed',
  weight_homework numeric NOT NULL DEFAULT 30,
  weight_tests numeric NOT NULL DEFAULT 50,
  weight_projects numeric NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.grade_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grade_classes S" ON public.grade_classes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own grade_classes I" ON public.grade_classes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own grade_classes U" ON public.grade_classes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own grade_classes D" ON public.grade_classes FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_grade_classes_updated BEFORE UPDATE ON public.grade_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.grade_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.grade_classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'homework',
  points_earned numeric,
  points_possible numeric NOT NULL DEFAULT 100,
  is_hypothetical boolean NOT NULL DEFAULT false,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.grade_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grade_assignments S" ON public.grade_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own grade_assignments I" ON public.grade_assignments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own grade_assignments U" ON public.grade_assignments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own grade_assignments D" ON public.grade_assignments FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_grade_assignments_updated BEFORE UPDATE ON public.grade_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_grade_assignments_class ON public.grade_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_grade_assignments_user ON public.grade_assignments(user_id);
