import { forwardRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  url?: string | null;
  name?: string | null;
  className?: string;
};

export const UserAvatar = forwardRef<HTMLSpanElement, Props>(function UserAvatar(
  { url, name, className },
  ref
) {
  const initials = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Avatar ref={ref} className={cn("h-9 w-9 ring-1 ring-white/15", className)}>
      {url ? <AvatarImage src={url} alt={name ?? "avatar"} /> : null}
      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs font-semibold">
        {initials || "??"}
      </AvatarFallback>
    </Avatar>
  );
});
