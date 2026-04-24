-- Replace broad SELECT policies on avatars + chat-images with owner-folder-only listing.
-- Public CDN URLs still work because the buckets remain public — RLS only controls API enumeration.

DROP POLICY IF EXISTS "Avatars publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read chat images" ON storage.objects;

CREATE POLICY "Avatars: owner can list own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Chat images: owner can list own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);