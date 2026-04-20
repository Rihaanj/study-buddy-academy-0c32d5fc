import { useState, lazy, Suspense } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

const EmojiPicker = lazy(() => import("emoji-picker-react").then((m) => ({ default: m.default })));

export function EmojiPickerButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Insert emoji">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 border-0 bg-transparent w-auto" align="end">
        <Suspense fallback={<div className="p-4 text-xs text-muted-foreground glass-strong rounded-lg">Loading...</div>}>
          <EmojiPicker
            theme={"dark" as any}
            onEmojiClick={(e: any) => { onPick(e.emoji); setOpen(false); }}
            width={320}
            height={400}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
