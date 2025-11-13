-- Table de logging des requêtes AI pour feedback loop
CREATE TABLE IF NOT EXISTS ai_query_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT,
  user_id TEXT DEFAULT 'default',
  question TEXT NOT NULL,
  intent TEXT, -- 'kpi' | 'doc' | 'howto' | 'code' | 'other'
  tool_used TEXT, -- 'sql' | 'ocr' | 'kb' | 'code' | 'template'
  sql_executed TEXT, -- Si SQL a été utilisé
  ok BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  row_count INTEGER,
  duration_ms INTEGER,
  feedback_rating INTEGER, -- NULL | 1 (👍) | -1 (👎)
  feedback_comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ai_query_log_feedback_rating_check CHECK (feedback_rating IN (NULL, 1, -1))
);

CREATE INDEX IF NOT EXISTS idx_ai_query_log_created_at ON ai_query_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_query_log_tool_used ON ai_query_log(tool_used);
CREATE INDEX IF NOT EXISTS idx_ai_query_log_ok ON ai_query_log(ok);
CREATE INDEX IF NOT EXISTS idx_ai_query_log_feedback ON ai_query_log(feedback_rating) WHERE feedback_rating IS NOT NULL;

COMMENT ON TABLE ai_query_log IS 'Logs des requêtes utilisateur vers l''agent IA avec feedback';

