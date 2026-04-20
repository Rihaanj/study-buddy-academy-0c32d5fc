// Clean text: strip weird unicode, normalize fractions/symbols to ASCII-friendly forms.
// Used for AI output and any user-displayed strings that may contain garbage characters.

const FRACTIONS: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

const REPLACEMENTS: Record<string, string> = {
  "—": "-", "–": "-", "−": "-",
  "“": '"', "”": '"', "„": '"', "‟": '"',
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "…": "...",
  "×": "x", "·": "*", "•": "-",
  "→": "->", "←": "<-", "⇒": "=>", "≥": ">=", "≤": "<=", "≠": "!=",
  "²": "^2", "³": "^3",
  "\u00A0": " ", // nbsp
  "\u200B": "",  // zero-width space
  "\u200C": "", "\u200D": "", "\uFEFF": "",
};

export function cleanText(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.normalize("NFKC");
  for (const [from, to] of Object.entries(FRACTIONS)) s = s.split(from).join(to);
  for (const [from, to] of Object.entries(REPLACEMENTS)) s = s.split(from).join(to);
  // Strip remaining non-printable / surrogate-pair garbage but keep common emoji ranges & basic latin/extended.
  // Allow: ASCII printable, latin extended, common math (kept), emoji range (rough), CJK (rough), newlines/tabs.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); // control chars
  return s;
}
