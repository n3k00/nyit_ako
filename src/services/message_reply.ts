import type {
  CachedMessage,
  GroupBehaviorProfile,
  GroupMemory,
  GroupSettings,
  MemberInteractionGuidance,
  ResponseMode,
} from "../types.ts";
import type { LlmProvider } from "./llm.ts";
import { buildChatPrompt } from "./prompt.ts";
import { checkSafety, sanitizeResponse } from "./safety.ts";

export interface GenerateModelReplyInput {
  llm: LlmProvider;
  mode: ResponseMode;
  group: GroupSettings;
  triggerUser: string;
  triggerText: string;
  repliedText?: string;
  recentMessages: CachedMessage[];
  groupProfile: GroupBehaviorProfile | null;
  memberGuidance: MemberInteractionGuidance | null;
  memories: GroupMemory[];
  allowLongAnswer?: boolean;
  ambient?: boolean;
}

export interface GenerateModelReplyResult {
  response: string;
  promptChars: number;
  promptMessages: Array<{ role: "system" | "user"; content: string }>;
}

export async function generateModelReply(
  input: GenerateModelReplyInput,
): Promise<GenerateModelReplyResult> {
  const promptMessages = buildChatPrompt({
    mode: input.mode,
    group: input.group,
    triggerUser: input.triggerUser,
    triggerText: input.triggerText,
    repliedText: input.repliedText,
    recentMessages: input.recentMessages,
    groupProfile: input.groupProfile,
    memberGuidance: input.memberGuidance,
    memories: input.memories,
    allowLongAnswer: input.allowLongAnswer,
    ambient: input.ambient,
  });

  const maxTokens = input.allowLongAnswer ? 1200 : input.ambient ? 260 : 500;
  let response = sanitizeResponse(
    await input.llm.complete(promptMessages, { maxTokens }),
    0,
  );
  if (!checkSafety(response).safe) response = "ဒီလိုတော့ မပြောတာကောင်းမယ်။";

  return {
    response,
    promptChars: promptMessages[0].content.length +
      promptMessages[1].content.length,
    promptMessages,
  };
}
