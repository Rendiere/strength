-- Strength app — 5-week program seed (spec §B, 2026-06-28).
-- Re-runnable: clears program/anchor_state then re-inserts. Never touches logs.

DELETE FROM program;
DELETE FROM anchor_state;

-- ── Rehab spine (Diana Todorova, both leg days, kind=rehab) ─────────────────
-- Inserted for BOTH leg_a and leg_b.
INSERT INTO program (session_type, exercise_key, name, kind, sets, rep_low, rep_high, load_kg, load_note, sort) VALUES
  ('leg_a','dl_squat','DL squat','rehab',3,10,10,18,'18–20 kg',10),
  ('leg_a','sl_calf_raise','SL calf raise','rehab',3,10,10,6,'6–8 kg, slow, no inward roll',20),
  ('leg_a','rdl','RDL','rehab',3,10,10,10,'2×10 kg',30),
  ('leg_a','lunges','Lunges','rehab',3,6,8,5,'2×5 kg',40),
  ('leg_a','glute_bridge','Glute bridge','rehab',3,10,10,NULL,'double / elevated',50),
  ('leg_a','penguin_march','Penguin march','rehab',1,20,20,NULL,NULL,60),
  ('leg_a','tibialis_raise','Tibialis raise','rehab',2,15,15,NULL,'mandatory every session',70),
  ('leg_a','ecc_calf_drop','Eccentric calf drop','rehab',2,10,10,NULL,'mandatory every session',80),

  ('leg_b','dl_squat','DL squat','rehab',3,10,10,18,'18–20 kg',10),
  ('leg_b','sl_calf_raise','SL calf raise','rehab',3,10,10,6,'6–8 kg, slow, no inward roll',20),
  ('leg_b','rdl','RDL','rehab',3,10,10,10,'2×10 kg',30),
  ('leg_b','lunges','Lunges','rehab',3,6,8,5,'2×5 kg',40),
  ('leg_b','glute_bridge','Glute bridge','rehab',3,10,10,NULL,'double / elevated',50),
  ('leg_b','penguin_march','Penguin march','rehab',1,20,20,NULL,NULL,60),
  ('leg_b','tibialis_raise','Tibialis raise','rehab',2,15,15,NULL,'mandatory every session',70),
  ('leg_b','ecc_calf_drop','Eccentric calf drop','rehab',2,10,10,NULL,'mandatory every session',80);

-- ── Leg A = rehab + PUSH focus ──────────────────────────────────────────────
INSERT INTO program (session_type, exercise_key, name, kind, sets, rep_low, rep_high, load_kg, load_note, sort) VALUES
  ('leg_a','pushup','Push-ups','bodyweight',NULL,NULL,NULL,NULL,'2×-max redistribution',90),
  ('leg_a','kb_ohp','KB overhead press','loaded',3,8,8,18,'single-arm alternating',100);

-- ── Leg B = rehab + PULL focus ──────────────────────────────────────────────
INSERT INTO program (session_type, exercise_key, name, kind, sets, rep_low, rep_high, load_kg, load_note, sort) VALUES
  ('leg_b','chinup','Chin-ups','bodyweight',NULL,NULL,NULL,NULL,'2×-max redistribution',90),
  ('leg_b','kb_row','KB bent-over row','loaded',3,10,10,18,'each side',100);

-- ── Upper +1 = the extra ────────────────────────────────────────────────────
INSERT INTO program (session_type, exercise_key, name, kind, sets, rep_low, rep_high, load_kg, load_note, sort) VALUES
  ('upper_1','kb_floor_press','KB floor press','loaded',3,10,10,18,'both 18 kg KBs',10),
  ('upper_1','dips','Dips','bodyweight',3,8,12,NULL,'add vest when topping range',20),
  ('upper_1','ring_curls','Ring bicep curls','bodyweight',3,10,12,NULL,'12 / 10 / 10',30),
  ('upper_1','band_face_pull','Band face pulls','loaded',2,15,15,NULL,'shoulder health, daily',40);

-- ── Anchor state (2×-max redistribution baselines, spec §B Wk 1–2) ───────────
INSERT INTO anchor_state (exercise_key, current_max, sets_json, rotate_index, updated_at) VALUES
  ('pushup', 20, '[14,13,13]', 0, datetime('now')),
  ('chinup', 9,  '[6,6,6]',    0, datetime('now'));
