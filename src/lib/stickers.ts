// Curated sticker pack — pure emoji-as-sticker (large rendered form)
// Free, no external assets, works offline.

export type Sticker = { id: string; emoji: string; label: string };

export const STICKER_CATEGORIES: { name: string; stickers: Sticker[] }[] = [
  {
    name: "Study",
    stickers: [
      { id: "study-1", emoji: "📚", label: "Books" },
      { id: "study-2", emoji: "✏️", label: "Pencil" },
      { id: "study-3", emoji: "🧠", label: "Brain" },
      { id: "study-4", emoji: "💡", label: "Idea" },
      { id: "study-5", emoji: "🎓", label: "Grad" },
      { id: "study-6", emoji: "📖", label: "Reading" },
      { id: "study-7", emoji: "🔬", label: "Science" },
      { id: "study-8", emoji: "🧪", label: "Lab" },
    ],
  },
  {
    name: "Hype",
    stickers: [
      { id: "hype-1", emoji: "🔥", label: "Fire" },
      { id: "hype-2", emoji: "💯", label: "100" },
      { id: "hype-3", emoji: "🚀", label: "Rocket" },
      { id: "hype-4", emoji: "⚡", label: "Lightning" },
      { id: "hype-5", emoji: "🏆", label: "Trophy" },
      { id: "hype-6", emoji: "🥇", label: "Gold" },
      { id: "hype-7", emoji: "💪", label: "Strong" },
      { id: "hype-8", emoji: "🎯", label: "Target" },
    ],
  },
  {
    name: "Mood",
    stickers: [
      { id: "mood-1", emoji: "😂", label: "Laugh" },
      { id: "mood-2", emoji: "😎", label: "Cool" },
      { id: "mood-3", emoji: "🤓", label: "Nerd" },
      { id: "mood-4", emoji: "😴", label: "Sleep" },
      { id: "mood-5", emoji: "🥲", label: "Tear-smile" },
      { id: "mood-6", emoji: "😭", label: "Cry" },
      { id: "mood-7", emoji: "🫠", label: "Melt" },
      { id: "mood-8", emoji: "🤯", label: "Mind-blown" },
    ],
  },
  {
    name: "Reactions",
    stickers: [
      { id: "react-1", emoji: "👍", label: "Thumbs up" },
      { id: "react-2", emoji: "👏", label: "Clap" },
      { id: "react-3", emoji: "🙌", label: "Hands up" },
      { id: "react-4", emoji: "❤️", label: "Heart" },
      { id: "react-5", emoji: "🎉", label: "Party" },
      { id: "react-6", emoji: "✨", label: "Sparkles" },
      { id: "react-7", emoji: "🫡", label: "Salute" },
      { id: "react-8", emoji: "🙏", label: "Pray" },
    ],
  },
];

const STICKER_PREFIX = "::sticker::";

export function isStickerMessage(text: string | null | undefined): boolean {
  return !!text && text.startsWith(STICKER_PREFIX);
}

export function encodeSticker(emoji: string): string {
  return `${STICKER_PREFIX}${emoji}`;
}

export function decodeSticker(text: string): string {
  return text.slice(STICKER_PREFIX.length);
}
