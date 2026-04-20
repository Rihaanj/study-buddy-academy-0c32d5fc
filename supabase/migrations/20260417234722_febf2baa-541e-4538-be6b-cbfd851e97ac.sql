-- 1) Allow re-friending: cleanup old request rows before insert
CREATE OR REPLACE FUNCTION public.cleanup_old_friend_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friend_requests
  WHERE id <> NEW.id
    AND (
      (from_user = NEW.from_user AND to_user = NEW.to_user) OR
      (from_user = NEW.to_user AND to_user = NEW.from_user)
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_old_friend_requests ON public.friend_requests;
CREATE TRIGGER trg_cleanup_old_friend_requests
BEFORE INSERT ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_friend_requests();

-- 2) Calendar event notes/description
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_events_updated_at ON public.events;
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();