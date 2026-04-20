import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "./UserAvatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AvatarUpload() {
  const { user } = useAuth();
  const { profile, reload } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("user_id", user.id);
      if (dbErr) throw dbErr;
      toast.success("Profile picture updated");
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <UserAvatar url={profile?.avatar_url} name={profile?.name} className="h-16 w-16" />
      <div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm" disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
          {uploading ? "Uploading..." : "Change picture"}
        </Button>
        <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
      </div>
    </div>
  );
}
