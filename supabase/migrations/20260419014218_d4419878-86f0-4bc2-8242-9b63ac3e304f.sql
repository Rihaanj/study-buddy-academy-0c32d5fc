CREATE TABLE IF NOT EXISTS public.cheat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_name TEXT,
  user_email TEXT,
  reason TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cheat_reports_status ON public.cheat_reports(status, created_at DESC);

ALTER TABLE public.cheat_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can file a report"
ON public.cheat_reports FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins read reports"
ON public.cheat_reports FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins update reports"
ON public.cheat_reports FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins delete reports"
ON public.cheat_reports FOR DELETE
USING (public.is_admin(auth.uid()));

-- Admin-only RPC: apply a 1-level penalty (-100 XP, floor at 0)
CREATE OR REPLACE FUNCTION public.admin_apply_level_penalty(_user_id UUID, _report_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_xp INT;
  new_xp INT;
  new_level INT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins may apply penalties';
  END IF;

  SELECT COALESCE(xp,0) INTO cur_xp FROM public.profiles WHERE user_id = _user_id;
  IF cur_xp IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  new_xp := GREATEST(0, cur_xp - 100);
  new_level := public.level_from_xp(new_xp);

  UPDATE public.profiles
  SET xp = new_xp, level = new_level, updated_at = now()
  WHERE user_id = _user_id;

  IF _report_id IS NOT NULL THEN
    UPDATE public.cheat_reports
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _report_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_apply_level_penalty(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_level_penalty(UUID, UUID) TO authenticated;