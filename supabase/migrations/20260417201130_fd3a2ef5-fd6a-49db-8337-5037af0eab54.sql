
-- =====================================================
-- 1. SIMPLE LEVELING: 100 XP per level
-- Update grant_packs trigger to use the new level math automatically (already uses NEW.level/OLD.level so no change needed)
-- We'll also add a helper function to recompute level from xp
-- =====================================================

CREATE OR REPLACE FUNCTION public.level_from_xp(_xp INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(1, (_xp / 100) + 1);
$$;

-- =====================================================
-- 2. AVATAR STORAGE BUCKET
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;
CREATE POLICY "Avatars publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users upload to their own folder
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- 3. FRIEND SYSTEM
-- =====================================================
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user)
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own requests"
  ON public.friend_requests FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "Send requests"
  ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = from_user AND from_user <> to_user);

CREATE POLICY "Recipient updates request"
  ON public.friend_requests FOR UPDATE
  USING (auth.uid() = to_user);

CREATE POLICY "Either party deletes request"
  ON public.friend_requests FOR DELETE
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- friendships: stored once with user_a < user_b for uniqueness
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Either friend can remove"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Trigger: when a request is accepted, create friendship
CREATE OR REPLACE FUNCTION public.handle_friend_request_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ua UUID;
  ub UUID;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    IF NEW.from_user < NEW.to_user THEN
      ua := NEW.from_user; ub := NEW.to_user;
    ELSE
      ua := NEW.to_user; ub := NEW.from_user;
    END IF;
    INSERT INTO public.friendships (user_a, user_b)
    VALUES (ua, ub)
    ON CONFLICT (user_a, user_b) DO NOTHING;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_request_accepted ON public.friend_requests;
CREATE TRIGGER trg_friend_request_accepted
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_friend_request_accepted();

-- Realtime
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;

-- =====================================================
-- 4. ALLOW FRIENDS TO INVITE EACH OTHER TO GROUPS
-- A user can add a friend to a group they belong to.
-- =====================================================

CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user_a = LEAST(_a,_b) AND user_b = GREATEST(_a,_b))
  );
$$;

DROP POLICY IF EXISTS "Members invite friends" ON public.group_members;
CREATE POLICY "Members invite friends"
  ON public.group_members FOR INSERT
  WITH CHECK (
    -- inviter is a member of the group AND invitee is a friend of inviter
    public.is_group_member(group_id, auth.uid())
    AND public.are_friends(auth.uid(), user_id)
  );
