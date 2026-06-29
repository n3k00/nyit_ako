import type { ResponseMode } from "../types.ts";

const SUPPORTIVE = [
  "stress",
  "depress",
  "anxiety",
  "sad",
  "sick",
  "health",
  "ဆေး",
  "နေမကောင်း",
  "စိတ်ညစ်",
  "ဝမ်းနည်း",
  "မခံနိုင်",
];
const HELPFUL = [
  "how",
  "why",
  "setup",
  "install",
  "error",
  "bug",
  "code",
  "api",
  "ဘယ်လို",
  "ဘာလို့",
  "ပြင်",
  "ကူညီ",
];
const REFEREE = [
  "argue",
  "fight",
  "who is right",
  "judge",
  "မှန်လား",
  "မှားလား",
  "ငြင်း",
  "ဆုံးဖြတ်",
];
const BANTER = [
  "lol",
  "haha",
  "game",
  "rank",
  "voice",
  "roast",
  "စ",
  "နောက်",
  "ဂိမ်း",
];

function hasAny(text: string, words: string[]): boolean {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

export function selectResponseMode(
  text: string,
  repliedText = "",
): ResponseMode {
  const combined = `${text}\n${repliedText}`.trim();
  if (hasAny(combined, SUPPORTIVE)) return "supportive";
  if (hasAny(combined, HELPFUL)) return "helpful";
  if (hasAny(combined, REFEREE)) return "referee";
  if (hasAny(combined, BANTER)) return "banter";
  return "default";
}
