export type ResponseMode =
  | "banter"
  | "helpful"
  | "referee"
  | "supportive"
  | "default";

export interface CachedMessage {
  message_id: number;
  user_id: number;
  username: string;
  content: string;
  timestamp: number;
}

export interface GroupSettings {
  chat_id: number;
  name: string;
  reply_length: "short" | "medium";
  humor_level: number;
  roast_level: number;
  memory_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupMemory {
  id: number;
  chat_id: number;
  fact: string;
  category: "inside_joke" | "preference" | "project" | "general";
  created_by: number;
  approved: boolean;
  created_at: string;
}

export interface MemberInteractionGuidance {
  user_id: number;
  chat_id?: number;
  preferred_reply_style?: string;
  humor_tolerance?: "low" | "medium" | "high";
  avoid_topics?: string[];
  response_length_preference?: "short" | "medium";
  likely_group_role?: string;
  confidence?: number;
  updated_at?: string;
  expires_at?: string;
}

export interface GroupBehaviorProfile {
  tone?: string;
  language?: string;
  boundaries?: string[];
  preferred_humor?: string;
  serious_mode_guidance?: string;
  updated_at?: string;
}
