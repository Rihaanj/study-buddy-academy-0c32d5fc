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
      { id: "study-9", emoji: "📝", label: "Notes" },
      { id: "study-10", emoji: "📐", label: "Geometry" },
      { id: "study-11", emoji: "📏", label: "Ruler" },
      { id: "study-12", emoji: "🖇️", label: "Clip" },
      { id: "study-13", emoji: "📓", label: "Notebook" },
      { id: "study-14", emoji: "🗂️", label: "Folders" },
      { id: "study-15", emoji: "🧮", label: "Abacus" },
      { id: "study-16", emoji: "🔭", label: "Telescope" },
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
      { id: "hype-9", emoji: "🌟", label: "Star" },
      { id: "hype-10", emoji: "💎", label: "Diamond" },
      { id: "hype-11", emoji: "🥳", label: "Party face" },
      { id: "hype-12", emoji: "🦾", label: "Power" },
      { id: "hype-13", emoji: "⭐", label: "Star" },
      { id: "hype-14", emoji: "🏅", label: "Medal" },
      { id: "hype-15", emoji: "🎖️", label: "Honor" },
      { id: "hype-16", emoji: "🔝", label: "Top" },
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
      { id: "mood-9", emoji: "😊", label: "Smile" },
      { id: "mood-10", emoji: "🥹", label: "Hold tears" },
      { id: "mood-11", emoji: "😅", label: "Sweat smile" },
      { id: "mood-12", emoji: "🤩", label: "Star eyes" },
      { id: "mood-13", emoji: "🥱", label: "Yawn" },
      { id: "mood-14", emoji: "😤", label: "Determined" },
      { id: "mood-15", emoji: "🫥", label: "Dotted" },
      { id: "mood-16", emoji: "🤔", label: "Thinking" },
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
      { id: "react-9", emoji: "👀", label: "Eyes" },
      { id: "react-10", emoji: "💀", label: "Skull" },
      { id: "react-11", emoji: "🤝", label: "Handshake" },
      { id: "react-12", emoji: "🫶", label: "Heart hands" },
      { id: "react-13", emoji: "👌", label: "OK" },
      { id: "react-14", emoji: "✅", label: "Check" },
      { id: "react-15", emoji: "❌", label: "X" },
      { id: "react-16", emoji: "💔", label: "Broken heart" },
    ],
  },
  {
    name: "Animals",
    stickers: [
      { id: "ani-1", emoji: "🐱", label: "Cat" },
      { id: "ani-2", emoji: "🐶", label: "Dog" },
      { id: "ani-3", emoji: "🦊", label: "Fox" },
      { id: "ani-4", emoji: "🐼", label: "Panda" },
      { id: "ani-5", emoji: "🦁", label: "Lion" },
      { id: "ani-6", emoji: "🐯", label: "Tiger" },
      { id: "ani-7", emoji: "🐧", label: "Penguin" },
      { id: "ani-8", emoji: "🦉", label: "Owl" },
      { id: "ani-9", emoji: "🐢", label: "Turtle" },
      { id: "ani-10", emoji: "🦄", label: "Unicorn" },
      { id: "ani-11", emoji: "🐝", label: "Bee" },
      { id: "ani-12", emoji: "🦋", label: "Butterfly" },
    ],
  },
  {
    name: "Food",
    stickers: [
      { id: "food-1", emoji: "☕", label: "Coffee" },
      { id: "food-2", emoji: "🍕", label: "Pizza" },
      { id: "food-3", emoji: "🍔", label: "Burger" },
      { id: "food-4", emoji: "🍩", label: "Donut" },
      { id: "food-5", emoji: "🍰", label: "Cake" },
      { id: "food-6", emoji: "🍿", label: "Popcorn" },
      { id: "food-7", emoji: "🥤", label: "Soda" },
      { id: "food-8", emoji: "🧋", label: "Boba" },
      { id: "food-9", emoji: "🍪", label: "Cookie" },
      { id: "food-10", emoji: "🍫", label: "Chocolate" },
      { id: "food-11", emoji: "🍎", label: "Apple" },
      { id: "food-12", emoji: "🍌", label: "Banana" },
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
