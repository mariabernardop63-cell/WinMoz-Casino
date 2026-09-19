-- Group chat messages table for persistent message history
-- Required by GrupoChat.tsx

CREATE TABLE IF NOT EXISTS group_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_initials TEXT NOT NULL DEFAULT '?',
  avatar_bg TEXT NOT NULL DEFAULT 'linear-gradient(135deg, #374151, #111827)',
  text TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast loading of recent messages
CREATE INDEX IF NOT EXISTS idx_group_chat_created ON group_chat_messages(created_at DESC);

-- RLS: anyone authenticated can read, only self can insert
ALTER TABLE group_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read group chat"
  ON group_chat_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert own messages"
  ON group_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for bot messages)
CREATE POLICY "Service role full access"
  ON group_chat_messages FOR ALL
  USING (true)
  WITH CHECK (true);
