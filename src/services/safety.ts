const BLOCKED_PATTERNS = [
  /\b(kill\s+(yourself|myself|them|him|her))\b/i,
  /\b(suicide|self[- ]?harm)\b/i,
  /\b(n[i1]gg[a@]|f[a@]gg?[o0]t|r[e3]t[a@]rd)\b/i,
  /\b(racist|sexist|homophobic)\s+(joke|comment|slur)\b/i,
];

const PERSONAL_ATTACK_PATTERNS = [
  /\b(ugly|stupid|dumb|idiot|retard)\b.*\b(you|your|u)\b/i,
  /\b(you|your|u)\b.*\b(ugly|stupid|dumb|idiot|retard)\b/i,
  /\b(no\s+one|nobody)\b.*\b(likes?|loves?|wants?)\b.*\b(you|u)\b/i,
];

export function checkSafety(text: string): { safe: boolean; reason: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason: "blocked_content" };
    }
  }

  let attackCount = 0;
  for (const pattern of PERSONAL_ATTACK_PATTERNS) {
    if (pattern.test(text)) {
      attackCount++;
    }
  }

  if (attackCount >= 2) {
    return { safe: false, reason: "personal_attack" };
  }

  return { safe: true, reason: "ok" };
}

export function sanitizeResponse(text: string): string {
  text = text.replace(/As an AI.*?,\s*/gi, "");
  text = text.replace(/I'm (just )?a(n)?.*?bot.*?,\s*/gi, "");
  text = text.trim();
  if (text.length > 1000) {
    text = text.substring(0, 1000) + "...";
  }
  return text;
}
