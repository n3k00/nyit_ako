CREATE TABLE IF NOT EXISTS groups (
  chat_id BIGINT PRIMARY KEY,
  name TEXT,
  personality TEXT DEFAULT 'chill_friend',
  roast_level INTEGER DEFAULT 1,
  context_mode TEXT DEFAULT 'mention_only',
  memory_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_memories (
  id BIGSERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES groups(chat_id),
  fact TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_by BIGINT NOT NULL,
  approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_memories_chat_id ON group_memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_group_memories_approved ON group_memories(approved);
