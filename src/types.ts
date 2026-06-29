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
  source_message_id?: number;
  approved: boolean;
  created_at: string;
}

export interface MemberInteractionGuidance {
  user_id: number;
  chat_id?: number;
  preferred_reply_style?:
    | "short"
    | "medium"
    | "detailed"
    | "practical"
    | "playful";
  humor_tolerance?: "low" | "light" | "medium";
  tech_detail_preference?: "basic" | "practical" | "detailed";
  avoid_topics?: string[];
  response_length_preference?: "short" | "medium" | "detailed";
  likely_group_role?:
    | "activity_starter"
    | "responder"
    | "tech_helper"
    | "quiet_member"
    | "unknown";
  confidence?: number;
  evidence_count?: number;
  last_observed_at?: string;
  updated_at?: string;
  expires_at?: string;
  explicit_no_roast?: boolean;
}

export type InteractionSignalType =
  | "prefers_practical_answer"
  | "prefers_detailed_answer"
  | "prefers_short_reply"
  | "positive_banter"
  | "starts_activity"
  | "practical_solution"
  | "explicit_no_roast"
  | "explicit_allow_roast";

export interface InteractionObservation {
  chat_id: number;
  user_id: number;
  signal_type: InteractionSignalType;
  weight: number;
  evidence_message_id: number;
  observed_at: string;
  expires_at: string;
}

export interface ShortTermTopic {
  label: string;
  confidence: number;
  last_seen_at: string;
}

export interface ShortTermGroupState {
  chat_id: number;
  current_topics: ShortTermTopic[];
  conversation_tone:
    | "playful"
    | "practical"
    | "serious"
    | "argumentative"
    | "mixed";
  recent_participants: number[];
  updated_at: string;
  expires_at: string;
}

export interface GroupBehaviorProfile {
  chat_id?: number;
  tone?: string;
  language?: string;
  boundaries?: string[];
  preferred_humor?: string;
  serious_mode_guidance?: string;
  confidence?: number;
  evidence_count?: number;
  updated_at?: string;
  expires_at?: string;
}
