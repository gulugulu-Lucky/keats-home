CREATE TABLE IF NOT EXISTS home_events (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  captured_date TEXT NOT NULL,
  summary TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'daily',
  salience REAL NOT NULL DEFAULT 0.5 CHECK (salience >= 0 AND salience <= 1),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'kept', 'discarded', 'used')),
  source TEXT NOT NULL DEFAULT 'chat',
  used_in TEXT,
  resolved_at INTEGER,
  metadata_json TEXT,
  dedupe_key TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_home_events_pending
  ON home_events(status, created_at);

CREATE INDEX IF NOT EXISTS idx_home_events_date
  ON home_events(captured_date, created_at);
