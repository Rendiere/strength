-- Strength app — D1 schema. Source of truth.

CREATE TABLE IF NOT EXISTS program (
  id           INTEGER PRIMARY KEY,
  session_type TEXT NOT NULL,            -- leg_a | leg_b | upper_1
  exercise_key TEXT NOT NULL,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL,            -- rehab | bodyweight | loaded
  sets         INTEGER,                  -- planned set count (null for anchors driven by anchor_state)
  rep_low      INTEGER,
  rep_high     INTEGER,
  load_kg      REAL,
  load_note    TEXT,
  sort         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS anchor_state (
  exercise_key TEXT PRIMARY KEY,         -- pushup | chinup
  current_max  INTEGER NOT NULL,
  sets_json    TEXT NOT NULL,            -- JSON int array, sum = 2 * current_max
  rotate_index INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,         -- client-generated UUID (idempotent push)
  date         TEXT NOT NULL,            -- ISO date/datetime
  session_type TEXT NOT NULL,
  notes        TEXT,
  created_at   TEXT
);

CREATE TABLE IF NOT EXISTS set_logs (
  id          TEXT PRIMARY KEY,          -- client-generated UUID
  session_id  TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  set_index   INTEGER NOT NULL,
  reps        INTEGER,
  weight_kg   REAL,
  created_at  TEXT
);

-- Tracks which sessions have already advanced an anchor, so re-pushing a queued
-- session (offline flush) never double-advances the redistribution table.
CREATE TABLE IF NOT EXISTS anchor_advances (
  session_id   TEXT NOT NULL,
  exercise_key TEXT NOT NULL,
  PRIMARY KEY (session_id, exercise_key)
);

CREATE INDEX IF NOT EXISTS idx_set_logs_session ON set_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_program_type ON program(session_type, sort);
