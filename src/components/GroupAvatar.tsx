import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  url?: string | null;
  name?: string | null;
  className?: string;
};

export function GroupAvatar({ url, name, className }: Props) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "group"}
        className={cn("h-9 w-9 rounded-full object-cover ring-1 ring-white/15", className)}
      />
    );
  }
  return (
    <div className={cn("h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center ring-1 ring-white/15", className)}>
      <Users className="h-4 w-4" />
    </div>
  );
}
