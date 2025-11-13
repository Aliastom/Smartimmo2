-- ============================================
-- SMARTIMMO - Tables pour Agent IA uniquement
-- (Les vues sont dans db/views/analytics.sql)
-- ============================================

-- Table des sessions de chat
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL DEFAULT 'default',
  context_json TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  meta_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_created_at ON ai_chat_sessions(created_at);

-- Table des messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls_json TEXT,
  tool_results_json TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_correlation_id ON ai_messages(correlation_id);

-- Table des logs d'outils
CREATE TABLE IF NOT EXISTS ai_tool_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT REFERENCES ai_messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  result_json TEXT,
  duration_ms INTEGER,
  ok BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_tool_name ON ai_tool_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_created_at ON ai_tool_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_correlation_id ON ai_tool_logs(correlation_id);

-- Table de logging des requêtes (feedback loop)
CREATE TABLE IF NOT EXISTS ai_query_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT,
  user_id TEXT DEFAULT 'default',
  question TEXT NOT NULL,
  intent TEXT,
  tool_used TEXT,
  sql_executed TEXT,
  ok BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  row_count INTEGER,
  duration_ms INTEGER,
  feedback_rating INTEGER,
  feedback_comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ai_query_log_feedback_rating_check CHECK (feedback_rating IN (NULL, 1, -1))
);

CREATE INDEX IF NOT EXISTS idx_ai_query_log_created_at ON ai_query_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_query_log_tool_used ON ai_query_log(tool_used);
CREATE INDEX IF NOT EXISTS idx_ai_query_log_ok ON ai_query_log(ok);
CREATE INDEX IF NOT EXISTS idx_ai_query_log_feedback ON ai_query_log(feedback_rating) WHERE feedback_rating IS NOT NULL;

-- Commentaires
COMMENT ON TABLE ai_chat_sessions IS 'Sessions de conversation avec l''agent IA';
COMMENT ON TABLE ai_messages IS 'Historique des messages (user + assistant + tool)';
COMMENT ON TABLE ai_tool_logs IS 'Logs d''exécution des outils (SQL, RAG, OCR, etc.)';
COMMENT ON TABLE ai_query_log IS 'Logs des requêtes utilisateur vers l''agent IA avec feedback';

