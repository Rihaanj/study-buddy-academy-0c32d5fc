import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FriendsLeaderboard } from "@/components/FriendsLeaderboard";
import { Trophy, Lock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const REQUIRED_FRIENDS = 10;

export default function Leaderboard() {
  const { user } = useAuth();
  const [friendCount, setFriendCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("id", { count: "exact" })
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      setFriendCount(data?.length ?? 0);
    })();
  }, [user?.id]);

  if (friendCount === null) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (friendCount < REQUIRED_FRIENDS) {
    const remaining = REQUIRED_FRIENDS - friendCount;
    const pct = Math.round((friendCount / REQUIRED_FRIENDS) * 100);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
            <Trophy className="h-6 w-6" /> Leaderboard
          </h1>
          <p className="text-muted-foreground text-sm">Compete weekly against your friend circle.</p>
        </div>

        <section className="glass p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 grid place-items-center ring-1 ring-primary/30">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Locked</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add <strong className="text-foreground">{remaining}</strong> more friend{remaining === 1 ? "" : "s"} to unlock the weekly leaderboard.
            </p>
          </div>

          <div className="max-w-xs mx-auto">
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {friendCount} / {REQUIRED_FRIENDS} friends
            </p>
          </div>

          <Link to="/friends">
            <Button className="bg-gradient-primary text-primary-foreground">
              <Users className="h-4 w-4 mr-2" /> Find friends
            </Button>
          </Link>

          <div className="text-left max-w-md mx-auto pt-4 border-t border-white/5 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">When unlocked, you'll get:</p>
            <p>🥇 1st: 10 packs · 🥈 2nd: 7 · 🥉 3rd: 5 · 4th: 4 · 5th: 3 · others: 2 · last: 0</p>
            <p>Resets every Monday 00:00 UTC to your friend-group average.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <Trophy className="h-6 w-6" /> Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm">Weekly ranking across your friend circle.</p>
      </div>
      <FriendsLeaderboard />
    </div>
  );
}
