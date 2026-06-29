import type {
  GroupMemory,
  GroupSettings,
  MemberInteractionGuidance,
} from "../types.ts";

interface LocalDB {
  groups: Record<string, GroupSettings>;
  memories: GroupMemory[];
  memberGuidance: Record<string, MemberInteractionGuidance>;
  nextMemoryId: number;
}

const DB_PATH = Deno.env.get("LOCAL_DB_PATH") || "data/local_db.json";
let db: LocalDB = {
  groups: {},
  memories: [],
  memberGuidance: {},
  nextMemoryId: 1,
};

export async function initLocalDB(): Promise<void> {
  try {
    const text = await Deno.readTextFile(DB_PATH);
    db = JSON.parse(text) as LocalDB;
    db.groups ||= {};
    db.memories ||= [];
    db.memberGuidance ||= {};
    db.nextMemoryId ||= 1;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    await Deno.mkdir("data", { recursive: true });
    await saveDB();
  }
}

async function saveDB(): Promise<void> {
  await Deno.mkdir("data", { recursive: true });
  await Deno.writeTextFile(DB_PATH, JSON.stringify(db, null, 2));
}

export async function getOrCreateGroup(
  chatId: number,
  name: string,
  defaults: Pick<GroupSettings, "reply_length" | "humor_level" | "roast_level">,
): Promise<GroupSettings> {
  const key = String(chatId);
  if (db.groups[key]) return db.groups[key];

  const now = new Date().toISOString();
  const group: GroupSettings = {
    chat_id: chatId,
    name,
    reply_length: defaults.reply_length,
    humor_level: defaults.humor_level,
    roast_level: defaults.roast_level,
    memory_enabled: false,
    created_at: now,
    updated_at: now,
  };
  db.groups[key] = group;
  await saveDB();
  return group;
}

export async function updateGroup(
  chatId: number,
  updates: Partial<GroupSettings>,
): Promise<GroupSettings> {
  const key = String(chatId);
  if (!db.groups[key]) {
    const now = new Date().toISOString();
    db.groups[key] = {
      chat_id: chatId,
      name: "",
      reply_length: "short",
      humor_level: 1,
      roast_level: 1,
      memory_enabled: false,
      created_at: now,
      updated_at: now,
    };
  }
  db.groups[key] = {
    ...db.groups[key],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  await saveDB();
  return db.groups[key];
}

export async function addMemory(
  chatId: number,
  fact: string,
  createdBy: number,
  category: GroupMemory["category"] = "general",
): Promise<GroupMemory> {
  const memory: GroupMemory = {
    id: db.nextMemoryId++,
    chat_id: chatId,
    fact,
    category,
    created_by: createdBy,
    approved: true,
    created_at: new Date().toISOString(),
  };
  db.memories.push(memory);
  await saveDB();
  return memory;
}

export function getMemories(
  chatId: number,
  limit = 10,
): GroupMemory[] {
  return db.memories
    .filter((memory) => memory.chat_id === chatId && memory.approved)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function clearGroupData(chatId: number): Promise<void> {
  db.memories = db.memories.filter((memory) => memory.chat_id !== chatId);
  await saveDB();
}

function guidanceKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

export function getMemberGuidance(
  chatId: number,
  userId: number,
): MemberInteractionGuidance | null {
  const guidance = db.memberGuidance[guidanceKey(chatId, userId)];
  if (!guidance) return null;
  if (guidance.expires_at && Date.parse(guidance.expires_at) < Date.now()) {
    return null;
  }
  return guidance;
}

export async function saveMemberGuidance(
  guidance: MemberInteractionGuidance,
): Promise<void> {
  if (typeof guidance.chat_id !== "number") return;
  db.memberGuidance[guidanceKey(guidance.chat_id, guidance.user_id)] = guidance;
  await saveDB();
}

export async function clearMemberGuidance(
  chatId: number,
  userId: number,
): Promise<void> {
  delete db.memberGuidance[guidanceKey(chatId, userId)];
  await saveDB();
}
