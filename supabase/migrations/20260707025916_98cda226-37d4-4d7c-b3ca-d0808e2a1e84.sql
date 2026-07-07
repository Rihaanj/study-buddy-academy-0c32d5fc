GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_history TO authenticated;
GRANT ALL ON public.ai_history TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.burn_list TO authenticated;
GRANT ALL ON public.burn_list TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_mastery TO authenticated;
GRANT ALL ON public.topic_mastery TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_buff_usage TO authenticated;
GRANT ALL ON public.daily_buff_usage TO service_role;

GRANT INSERT ON public.cheat_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cheat_reports TO service_role;