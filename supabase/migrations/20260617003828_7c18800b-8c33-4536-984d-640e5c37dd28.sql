
-- 1) Drop user_email from cheat_reports (untrusted user-supplied value)
ALTER TABLE public.cheat_reports DROP COLUMN IF EXISTS user_email;

-- 2) Allow chat participants to read chat-images via storage SELECT
--    Path layouts:
--      DM/AI:  <uploaderId>/<timestamp>-<filename>     -> referenced in dm_messages.image_url / messages.image_url
--      Group:  <uploaderId>/group-<groupId>-<...>     -> referenced as groups.image_url and in messages.image_url
CREATE POLICY "chat-images participants read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    -- DM participant of a message referencing this object
    EXISTS (
      SELECT 1 FROM public.dm_messages m
      JOIN public.dm_chats c ON c.id = m.chat_id
      WHERE m.image_url LIKE '%/' || storage.objects.name || '%'
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
    -- Group member of a group referenced via group message
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.image_url LIKE '%/' || storage.objects.name || '%'
        AND public.is_group_member(m.group_id, auth.uid())
    )
    -- Group avatar (path embeds group-<groupId>-)
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE storage.objects.name LIKE '%group-' || g.id::text || '-%'
        AND public.is_group_member(g.id, auth.uid())
    )
  )
);
