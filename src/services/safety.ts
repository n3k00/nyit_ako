const BLOCKED_PATTERNS = [
  /\b(kill\s+(yourself|myself|them|him|her))\b/i,
  /\b(suicide|self[- ]?harm)\b/i,
  /\b(n[i1]gg[a@]|f[a@]gg?[o0]t|r[e3]t[a@]rd)\b/i,
  /\b(doxx|address|phone number)\b/i,
];

const HIDDEN_PROFILE_PATTERNS = [
  /personality profile/i,
  /hidden profile/i,
  /private context/i,
  /based on your profile/i,
  /group says you always/i,
];

export function checkSafety(text: string): { safe: boolean; reason: string } {
  for (const pattern of [...BLOCKED_PATTERNS, ...HIDDEN_PROFILE_PATTERNS]) {
    if (pattern.test(text)) return { safe: false, reason: "blocked_content" };
  }
  return { safe: true, reason: "ok" };
}

export function sanitizeResponse(text: string, maxLength = 1000): string {
  let output = text
    .replace(/As an AI.*?,\s*/gi, "")
    .replace(/I'm (just )?a(n)?.*?bot.*?,\s*/gi, "")
    .trim();

  if (output.length > maxLength) {
    output = `${output.slice(0, maxLength - 3).trim()}...`;
  }
  return output;
}
