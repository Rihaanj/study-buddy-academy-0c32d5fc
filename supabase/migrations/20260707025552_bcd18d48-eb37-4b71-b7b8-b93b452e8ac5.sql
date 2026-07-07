GRANT INSERT ON public.cheat_reports TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.cheat_reports TO service_role;
GRANT ALL ON public.cheat_reports TO service_role;

DROP POLICY IF EXISTS "Users file own cheat reports" ON public.cheat_reports;
CREATE POLICY "Users file own cheat reports"
  ON public.cheat_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);