import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config.ts";

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }
  return supabase;
}

export const PERSONALITIES: Record<string, string> = {
  chill_friend: "You are a chill friend in a group chat. You speak casually, use humor occasionally, and keep things relaxed. You don't overexplain. You respond like a real friend would.",
  deadpan_judge: "You are a deadpan judge in a group chat. You deliver emotionless sarcasm. You give verdicts on arguments with dry wit. No enthusiasm, just cold observations.",
  chaotic_gremlin: "You are a chaotic gremlin in a group chat. You speak in short, meme-style bursts. You're absurd, unpredictable, and funny. Keep responses punchy.",
  helpful_nerd: "You are a helpful nerd in a group chat. When asked about tech or facts, you give thorough but not boring answers. You're the friend everyone asks for explanations.",
  group_elder: "You are the wise elder of a group chat. When people argue, you mediate calmly. You give balanced perspectives and occasionally drop wisdom. You're respected, not preachy.",
};

export interface Group {
  chat_id: number;
  name: string;
  personality: string;
  roast_level: number;
  context_mode: string;
  memory_enabled: boolean;
  created_at: string;
}

export interface GroupMemory {
  id: number;
  chat_id: number;
  fact: string;
  category: string;
  created_by: number;
  approved: boolean;
  created_at: string;
}

export async function getOrCreateGroup(chatId: number, name: string = ""): Promise<Group> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("groups")
    .select("*")
    .eq("chat_id", chatId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (data) {
    return data as Group;
  }

  const { data: newGroup, error: insertError } = await sb
    .from("groups")
    .insert({
      chat_id: chatId,
      name: name,
      personality: config.defaultPersonality,
      roast_level: config.defaultRoastLevel,
      context_mode: "mention_only",
      memory_enabled: false,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return newGroup as Group;
}

export async function updateGroup(chatId: number, updates: Partial<Group>): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("groups")
    .update(updates)
    .eq("chat_id", chatId);

  if (error) {
    throw error;
  }
}

export async function addMemory(chatId: number, fact: string, createdBy: number, category: string = "general"): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("group_memories")
    .insert({
      chat_id: chatId,
      fact: fact,
      category: category,
      created_by: createdBy,
      approved: true,
    });

  if (error) {
    throw error;
  }
}

export async function getMemories(chatId: number): Promise<GroupMemory[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("group_memories")
    .select("*")
    .eq("chat_id", chatId)
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as GroupMemory[];
}

const rateLimitWindow: Map<string, number[]> = new Map();

export async function checkRateLimit(chatId: number, userId: number): Promise<boolean> {
  const key = `${chatId}:${userId}`;
  const now = Date.now();
  const windowMs = 60000;
  const limit = config.rateLimitPerMinute;

  let timestamps = rateLimitWindow.get(key) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= limit) {
    return false;
  }

  timestamps.push(now);
  rateLimitWindow.set(key, timestamps);
  return true;
}
