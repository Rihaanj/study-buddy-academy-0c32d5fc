import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star, Lock } from "lucide-react";
import { format } from "date-fns";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type Reviewer = { user_id: string; name: string | null; email: string | null; avatar_url: string | null };

export default function Reviews() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewers, setReviewers] = useState<Record<string, Reviewer>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const admin = !!roles;
      setIsAdmin(admin);
      if (!admin) return;

      const { data: rs } = await supabase
        .from("reviews" as any)
        .select("*")
        .order("created_at", { ascending: false });
      const list = (rs ?? []) as any as Review[];
      setReviews(list);

      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name, email, avatar_url")
          .in("user_id", ids);
        const map: Record<string, Reviewer> = {};
        for (const p of profs ?? []) map[p.user_id] = p as any;
        setReviewers(map);
      }
    })();
  }, [user?.id]);

  if (loading || isAdmin === null) {
    return <div className="text-muted-foreground">Loading...</div>;
  }
  if (!isAdmin) {
    return (
      <div className="glass p-8 text-center">
        <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p>This page is admin-only.</p>
        <Navigate to="/" replace />
      </div>
    );
  }

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text">User Reviews</h1>
        <p className="text-muted-foreground text-sm">Admin view — only you can see this.</p>
      </div>
      <div className="glass-strong p-5 rounded-xl flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Average rating</div>
          <div className="text-3xl font-bold gradient-text">{avg.toFixed(2)} / 5</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
          <div className="text-3xl font-bold">{reviews.length}</div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="glass p-8 text-center text-muted-foreground">No reviews yet.</div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const u = reviewers[r.user_id];
            return (
              <div key={r.id} className="glass p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium">{u?.name ?? "Unknown user"}</div>
                    <div className="text-xs text-muted-foreground">{u?.email}</div>
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm whitespace-pre-wrap">{r.comment}</p>}
                <div className="text-[10px] text-muted-foreground mt-2">
                  {format(new Date(r.created_at), "PPpp")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
