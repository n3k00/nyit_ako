import type {
  GroupBehaviorProfile,
  GroupMemory,
  GroupSettings,
  InteractionObservation,
  MemberInteractionGuidance,
  ShortTermGroupState,
} from "../types.ts";

interface LocalDB {
  groups: Record<string, GroupSettings>;
  memories: GroupMemory[];
  memberGuidance: Record<string, MemberInteractionGuidance>;
  observations: InteractionObservation[];
  groupStates: Record<string, ShortTermGroupState>;
  groupProfiles: Record<string, GroupBehaviorProfile>;
  nextMemoryId: number;
}

const DB_PATH = Deno.env.get("LOCAL_DB_PATH") || "data/local_db.json";
let db: LocalDB = {
  groups: {},
  memories: [],
  memberGuidance: {},
  observations: [],
  groupStates: {},
  groupProfiles: {},
  nextMemoryId: 1,
};

export async function initLocalDB(): Promise<void> {
  try {
    const text = await Deno.readTextFile(DB_PATH);
    db = JSON.parse(text) as LocalDB;
    db.groups ||= {};
    db.memories ||= [];
    db.memberGuidance ||= {};
    db.observations ||= [];
    db.groupStates ||= {};
    db.groupProfiles ||= {};
    db.nextMemoryId ||= 1;
    await cleanupExpiredLearning();
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
  sourceMessageId?: number,
): Promise<GroupMemory> {
  const memory: GroupMemory = {
    id: db.nextMemoryId++,
    chat_id: chatId,
    fact,
    category,
    created_by: createdBy,
    source_message_id: sourceMessageId,
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
  db.observations = db.observations.filter((item) => item.chat_id !== chatId);
  delete db.groupStates[String(chatId)];
  delete db.groupProfiles[String(chatId)];
  for (const key of Object.keys(db.memberGuidance)) {
    if (key.startsWith(`${chatId}:`)) delete db.memberGuidance[key];
  }
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
  db.observations = db.observations.filter((item) =>
    !(item.chat_id === chatId && item.user_id === userId)
  );
  await saveDB();
}

export function getInteractionObservations(
  chatId: number,
  userId: number,
): InteractionObservation[] {
  const now = Date.now();
  return db.observations.filter((item) =>
    item.chat_id === chatId && item.user_id === userId &&
    Date.parse(item.expires_at) > now
  );
}

export async function addInteractionObservation(
  observation: InteractionObservation,
): Promise<void> {
  const exists = db.observations.some((item) =>
    item.chat_id === observation.chat_id &&
    item.user_id === observation.user_id &&
    item.evidence_message_id === observation.evidence_message_id &&
    item.signal_type === observation.signal_type
  );
  if (!exists) db.observations.push(observation);
  await cleanupExpiredLearning(false);
  await saveDB();
}

export function getShortTermGroupState(
  chatId: number,
): ShortTermGroupState | null {
  const state = db.groupStates[String(chatId)];
  if (!state || Date.parse(state.expires_at) < Date.now()) return null;
  return state;
}

export async function saveShortTermGroupState(
  state: ShortTermGroupState,
): Promise<void> {
  db.groupStates[String(state.chat_id)] = state;
  await saveDB();
}

export function getGroupBehaviorProfile(
  chatId: number,
): GroupBehaviorProfile | null {
  const profile = db.groupProfiles[String(chatId)];
  if (
    !profile ||
    (profile.expires_at && Date.parse(profile.expires_at) < Date.now())
  ) {
    return null;
  }
  return profile;
}

export async function saveGroupBehaviorProfile(
  profile: GroupBehaviorProfile,
): Promise<void> {
  if (typeof profile.chat_id !== "number") return;
  db.groupProfiles[String(profile.chat_id)] = profile;
  await saveDB();
}

export async function cleanupExpiredLearning(write = true): Promise<void> {
  const now = Date.now();
  db.observations = db.observations.filter((item) =>
    Date.parse(item.expires_at) > now
  );
  for (const [key, guidance] of Object.entries(db.memberGuidance)) {
    if (guidance.expires_at && Date.parse(guidance.expires_at) <= now) {
      delete db.memberGuidance[key];
    }
  }
  for (const [key, state] of Object.entries(db.groupStates)) {
    if (Date.parse(state.expires_at) <= now) delete db.groupStates[key];
  }
  for (const [key, profile] of Object.entries(db.groupProfiles)) {
    if (profile.expires_at && Date.parse(profile.expires_at) <= now) {
      delete db.groupProfiles[key];
    }
  }
  if (write) await saveDB();
}
