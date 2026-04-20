import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sticker as StickerIcon } from "lucide-react";
import { STICKER_CATEGORIES } from "@/lib/stickers";

export function StickerPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(STICKER_CATEGORIES[0].name);
  const active = STICKER_CATEGORIES.find((c) => c.name === tab) ?? STICKER_CATEGORIES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Send sticker">
          <StickerIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 glass-strong" align="end">
        <div className="flex gap-1 mb-2 flex-wrap">
          {STICKER_CATEGORIES.map((c) => (
            <button
              key={c.name}
              onClick={() => setTab(c.name)}
              className={`text-xs px-2 py-1 rounded-md transition ${
                tab === c.name ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {active.stickers.map((s) => (
            <button
              key={s.id}
              onClick={() => { onPick(s.emoji); setOpen(false); }}
              className="text-3xl aspect-square rounded-lg hover:bg-white/10 transition grid place-items-center"
              aria-label={s.label}
              title={s.label}
            >
              {s.emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
