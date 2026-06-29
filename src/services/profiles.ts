import type {
  GroupBehaviorProfile,
  MemberInteractionGuidance,
} from "../types.ts";

async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await Deno.readTextFile(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null;
    throw error;
  }
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string")
    .slice(0, 12);
}

export async function loadGroupBehaviorProfile(
  path: string,
): Promise<GroupBehaviorProfile | null> {
  const raw = await readJsonIfExists(path);
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  return {
    tone: typeof source.tone === "string" ? source.tone : undefined,
    language: typeof source.language === "string" ? source.language : undefined,
    boundaries: stringArray(source.boundaries),
    preferred_humor: typeof source.preferred_humor === "string"
      ? source.preferred_humor
      : undefined,
    serious_mode_guidance: typeof source.serious_mode_guidance === "string"
      ? source.serious_mode_guidance
      : undefined,
    updated_at: typeof source.updated_at === "string"
      ? source.updated_at
      : undefined,
  };
}

export async function loadMemberInteractionGuidance(
  path: string,
  chatId: number,
  userId: number,
): Promise<MemberInteractionGuidance | null> {
  const raw = await readJsonIfExists(path);
  if (!raw || typeof raw !== "object") return null;

  const source = raw as Record<string, unknown>;
  const candidates = [
    source[`${chatId}:${userId}`],
    source[String(userId)],
  ];
  const match = candidates.find((candidate) =>
    candidate && typeof candidate === "object"
  ) as Record<string, unknown> | undefined;
  if (!match) return null;

  const expiresAt = typeof match.expires_at === "string"
    ? match.expires_at
    : undefined;
  if (expiresAt && Date.parse(expiresAt) < Date.now()) return null;

  return {
    user_id: userId,
    chat_id: chatId,
    preferred_reply_style: typeof match.preferred_reply_style === "string"
      ? match.preferred_reply_style
      : undefined,
    humor_tolerance:
      match.humor_tolerance === "low" || match.humor_tolerance === "medium" ||
        match.humor_tolerance === "high"
        ? match.humor_tolerance
        : undefined,
    avoid_topics: stringArray(match.avoid_topics),
    response_length_preference: match.response_length_preference === "short" ||
        match.response_length_preference === "medium"
      ? match.response_length_preference
      : undefined,
    likely_group_role: typeof match.likely_group_role === "string"
      ? match.likely_group_role
      : undefined,
    confidence: typeof match.confidence === "number"
      ? Math.min(Math.max(match.confidence, 0), 1)
      : undefined,
    updated_at: typeof match.updated_at === "string"
      ? match.updated_at
      : undefined,
    expires_at: expiresAt,
  };
}
