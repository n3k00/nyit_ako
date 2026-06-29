import { config } from "../config.ts";

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

const DB_PATH = "data/local_db.json";

interface LocalDB {
  groups: Record<string, Group>;
  memories: GroupMemory[];
  nextMemoryId: number;
}

let db: LocalDB = { groups: {}, memories: [], nextMemoryId: 1 };

export async function initLocalDB(): Promise<void> {
  try {
    const text = await Deno.readTextFile(DB_PATH);
    db = JSON.parse(text);
    console.log("Local DB loaded");
  } catch {
    await Deno.mkdir("data", { recursive: true });
    await saveDB();
    console.log("Local DB created");
  }
}

async function saveDB(): Promise<void> {
  await Deno.writeTextFile(DB_PATH, JSON.stringify(db, null, 2));
}

export async function getOrCreateGroup(chatId: number, name: string = ""): Promise<Group> {
  const key = String(chatId);
  if (db.groups[key]) {
    return db.groups[key];
  }

  const group: Group = {
    chat_id: chatId,
    name: name,
    personality: config.defaultPersonality,
    roast_level: config.defaultRoastLevel,
    context_mode: "mention_only",
    memory_enabled: false,
    created_at: new Date().toISOString(),
  };

  db.groups[key] = group;
  await saveDB();
  return group;
}

export async function updateGroup(chatId: number, updates: Partial<Group>): Promise<void> {
  const key = String(chatId);
  if (!db.groups[key]) {
    await getOrCreateGroup(chatId);
  }
  Object.assign(db.groups[key], updates);
  await saveDB();
}

export async function addMemory(chatId: number, fact: string, createdBy: number, category: string = "general"): Promise<void> {
  const memory: GroupMemory = {
    id: db.nextMemoryId++,
    chat_id: chatId,
    fact: fact,
    category: category,
    created_by: createdBy,
    approved: true,
    created_at: new Date().toISOString(),
  };
  db.memories.push(memory);
  await saveDB();
}

export async function getMemories(chatId: number): Promise<GroupMemory[]> {
  return db.memories
    .filter((m) => m.chat_id === chatId && m.approved)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
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
