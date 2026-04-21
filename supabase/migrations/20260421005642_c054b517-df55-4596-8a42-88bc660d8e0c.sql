
-- =======================================================
-- 1. GROUP MEMBER ROLES (host / co-host / member)
-- =======================================================
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- Backfill: creator of each group becomes host
UPDATE public.group_members gm
SET role = 'host'
FROM public.groups g
WHERE gm.group_id = g.id
  AND gm.user_id = g.created_by
  AND gm.role <> 'host';

-- Helper: is user a host or cohost of the group?
CREATE OR REPLACE FUNCTION public.is_group_host(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id
      AND user_id = _user_id
      AND role IN ('host','cohost')
  );
$$;

-- Auto-assign 'host' role to the creator on group creation
CREATE OR REPLACE FUNCTION public.add_creator_as_host()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'host')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_add_creator_as_host ON public.groups;
CREATE TRIGGER trg_add_creator_as_host
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_host();

-- Allow hosts to remove anyone; members can still leave themselves
DROP POLICY IF EXISTS "Hosts remove members" ON public.group_members;
CREATE POLICY "Hosts remove members"
ON public.group_members
FOR DELETE TO public
USING (public.is_group_host(group_id, auth.uid()) OR auth.uid() = user_id);

-- Allow hosts to update roles (promote / demote)
DROP POLICY IF EXISTS "Hosts update member roles" ON public.group_members;
CREATE POLICY "Hosts update member roles"
ON public.group_members
FOR UPDATE TO public
USING (public.is_group_host(group_id, auth.uid()))
WITH CHECK (public.is_group_host(group_id, auth.uid()));

-- Hosts can invite anyone (not just friends) — relax invite rule
DROP POLICY IF EXISTS "Members invite friends" ON public.group_members;
DROP POLICY IF EXISTS "Hosts invite members" ON public.group_members;
CREATE POLICY "Hosts invite members"
ON public.group_members
FOR INSERT TO public
WITH CHECK (public.is_group_host(group_id, auth.uid()));

-- Allow hosts to DELETE groups
DROP POLICY IF EXISTS "Hosts delete group" ON public.groups;
CREATE POLICY "Hosts delete group"
ON public.groups
FOR DELETE TO public
USING (public.is_group_host(id, auth.uid()) OR created_by = auth.uid());

-- Cascade-delete messages & members when a group is deleted
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_group_id_fkey,
  ADD CONSTRAINT messages_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

ALTER TABLE public.group_members
  DROP CONSTRAINT IF EXISTS group_members_group_id_fkey,
  ADD CONSTRAINT group_members_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;

-- =======================================================
-- 2. DIRECT MESSAGES (1-on-1 chats)
-- =======================================================
CREATE TABLE IF NOT EXISTS public.dm_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dm_pair_ordered CHECK (user_a < user_b),
  CONSTRAINT dm_pair_unique UNIQUE (user_a, user_b)
);

ALTER TABLE public.dm_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view DM"
ON public.dm_chats FOR SELECT TO public
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Friends create DM"
ON public.dm_chats FOR INSERT TO public
WITH CHECK (
  (auth.uid() = user_a OR auth.uid() = user_b)
  AND public.are_friends(user_a, user_b)
);

CREATE POLICY "Participants delete DM"
ON public.dm_chats FOR DELETE TO public
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.dm_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  text TEXT,
  image_url TEXT,
  deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_dm_participant(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_chats
    WHERE id = _chat_id AND (user_a = _user_id OR user_b = _user_id)
  );
$$;

CREATE POLICY "Participants read DM messages"
ON public.dm_messages FOR SELECT TO public
USING (public.is_dm_participant(chat_id, auth.uid()));

CREATE POLICY "Participants send DM messages"
ON public.dm_messages FOR INSERT TO public
WITH CHECK (public.is_dm_participant(chat_id, auth.uid()) AND auth.uid() = user_id);

CREATE POLICY "Authors soft-delete own DM messages"
ON public.dm_messages FOR UPDATE TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Auto-delete DM chat when a friendship is removed
CREATE OR REPLACE FUNCTION public.delete_dm_on_unfriend()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.dm_chats
  WHERE user_a = OLD.user_a AND user_b = OLD.user_b;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_delete_dm_on_unfriend ON public.friendships;
CREATE TRIGGER trg_delete_dm_on_unfriend
AFTER DELETE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.delete_dm_on_unfriend();

-- Adds soft-delete flag on group messages too so "this message was deleted" can render
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;

-- Allow authors to soft-delete group messages (UPDATE deleted=true) instead of hard delete
DROP POLICY IF EXISTS "Authors soft-delete own messages" ON public.messages;
CREATE POLICY "Authors soft-delete own messages"
ON public.messages FOR UPDATE TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =======================================================
-- 3. WEATHER LOCATION ON PROFILES
-- =======================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weather_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS weather_lon NUMERIC,
  ADD COLUMN IF NOT EXISTS weather_city TEXT;

-- =======================================================
-- 4. REALTIME PUBLICATION
-- =======================================================
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.dm_chats REPLICA IDENTITY FULL;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_chats; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.groups; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =======================================================
-- 5. PACKS EVERY LEVEL (update trigger from every 2 levels → every level)
-- =======================================================
CREATE OR REPLACE FUNCTION public.grant_packs_on_level_up()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  diff INT; i INT; pack_rarity TEXT; roll FLOAT; pity INT;
BEGIN
  IF NEW.level IS NULL OR OLD.level IS NULL OR NEW.level <= OLD.level THEN
    RETURN NEW;
  END IF;
  diff := NEW.level - OLD.level;
  pity := COALESCE(NEW.pack_pity_count, 0);
  FOR i IN 1..diff LOOP
    pity := pity + 1;
    IF pity >= 10 THEN
      roll := random();
      IF roll < 0.10 THEN pack_rarity := 'mythic';
      ELSIF roll < 0.35 THEN pack_rarity := 'legendary';
      ELSE pack_rarity := 'epic';
      END IF;
      pity := 0;
    ELSE
      roll := random();
      IF roll < 0.02 THEN pack_rarity := 'mythic';
      ELSIF roll < 0.07 THEN pack_rarity := 'legendary';
      ELSIF roll < 0.20 THEN pack_rarity := 'epic';
      ELSIF roll < 0.50 THEN pack_rarity := 'rare';
      ELSE pack_rarity := 'common';
      END IF;
    END IF;
    INSERT INTO public.inventory (user_id, item_type, item_key, rarity, metadata)
    VALUES (NEW.user_id, 'pack', 'buff_pack', pack_rarity,
      jsonb_build_object('opened', false, 'awarded_at_level', OLD.level + i,
                         'guaranteed', (pack_rarity IN ('epic','legendary','mythic') AND COALESCE(NEW.pack_pity_count,0)+1 >= 10)));
  END LOOP;
  UPDATE public.profiles SET pack_pity_count = pity WHERE user_id = NEW.user_id;
  RETURN NEW;
END; $$;
