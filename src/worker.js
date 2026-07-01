// Strength app — Cloudflare Worker API. D1 is the source of truth.
// Routes: /api/health, /api/today, /api/pull, /api/push, /api/export.
// Everything else falls through to static PWA assets.

import { advanceRedistribution } from "./progression.js";
import { sessionToWorkoutLog } from "./openweight.js";
import { weeklyCoverage } from "./muscles.js";

const ANCHORS = new Set(["pushup", "chinup"]);
const JSON_HEADERS = { "content-type": "application/json" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    try {
      if (pathname === "/api/health") return json({ ok: true });
      if (pathname === "/api/today") return await getToday(url, env);
      if (pathname === "/api/pull") return await getPull(url, env);
      if (pathname === "/api/push" && request.method === "POST") return await postPush(request, env);
      if (pathname === "/api/coverage") return await getCoverage(url, env);
      if (pathname === "/api/export") return await getExport(env);
      if (pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
      return env.ASSETS.fetch(request);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500);
    }
  },
};

// GET /api/today?type=leg_a — planned session with anchor sets pre-filled.
async function getToday(url, env) {
  const type = url.searchParams.get("type") || "leg_a";
  const { results: program } = await env.DB.prepare(
    "SELECT exercise_key, name, kind, sets, rep_low, rep_high, load_kg, load_note FROM program WHERE session_type = ? ORDER BY sort"
  ).bind(type).all();

  const { results: anchors } = await env.DB.prepare("SELECT exercise_key, current_max, sets_json FROM anchor_state").all();
  const anchorMap = new Map(anchors.map((a) => [a.exercise_key, a]));

  const blocks = program.map((p) => {
    const anchor = anchorMap.get(p.exercise_key);
    let sets;
    if (p.kind === "bodyweight" && anchor) {
      const arr = JSON.parse(anchor.sets_json);
      sets = arr.map((reps, i) => ({ set_index: i, target_reps: reps, weight_kg: null, rep_low: null, rep_high: null }));
    } else {
      const n = p.sets || 1;
      sets = Array.from({ length: n }, (_, i) => ({
        set_index: i,
        target_reps: p.rep_high ?? p.rep_low ?? null,
        weight_kg: p.load_kg ?? null,
        rep_low: p.rep_low ?? null,
        rep_high: p.rep_high ?? null,
      }));
    }
    return {
      exercise_key: p.exercise_key,
      name: p.name,
      kind: p.kind,
      load_note: p.load_note || null,
      is_anchor: !!anchor,
      current_max: anchor ? anchor.current_max : null,
      sets,
    };
  });

  return json({ session_type: type, blocks });
}

// GET /api/pull?since=<iso> — sessions, set_logs, anchor_state for sync/restore.
async function getPull(url, env) {
  const since = url.searchParams.get("since");
  const sessions = since
    ? (await env.DB.prepare("SELECT * FROM sessions WHERE date >= ? ORDER BY date").bind(since).all()).results
    : (await env.DB.prepare("SELECT * FROM sessions ORDER BY date").all()).results;
  const set_logs = since
    ? (await env.DB.prepare(
        "SELECT sl.* FROM set_logs sl JOIN sessions s ON s.id = sl.session_id WHERE s.date >= ? ORDER BY sl.set_index"
      ).bind(since).all()).results
    : (await env.DB.prepare("SELECT * FROM set_logs ORDER BY set_index").all()).results;
  const anchor_state = (await env.DB.prepare("SELECT * FROM anchor_state").all()).results;
  return json({ sessions, set_logs, anchor_state });
}

// POST /api/push — idempotent upsert of sessions+set_logs, then advance anchors once per session.
async function postPush(request, env) {
  const body = await request.json();
  const sessions = body.sessions || [];
  const setLogs = body.set_logs || [];
  const now = new Date().toISOString();

  for (const s of sessions) {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO sessions (id, date, session_type, notes, created_at) VALUES (?,?,?,?,?)"
    ).bind(s.id, s.date, s.session_type ?? null, s.notes ?? null, s.created_at ?? now).run();
  }
  for (const r of setLogs) {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO set_logs (id, session_id, exercise_key, name, kind, set_index, reps, weight_kg, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).bind(r.id, r.session_id, r.exercise_key, r.name, r.kind, r.set_index, r.reps ?? null, r.weight_kg ?? null, r.created_at ?? now).run();
  }

  // Advance redistribution anchors — once per (session, anchor), idempotent.
  for (const s of sessions) {
    const present = new Set(setLogs.filter((r) => r.session_id === s.id && ANCHORS.has(r.exercise_key)).map((r) => r.exercise_key));
    for (const key of present) {
      const already = await env.DB.prepare("SELECT 1 FROM anchor_advances WHERE session_id = ? AND exercise_key = ?").bind(s.id, key).first();
      if (already) continue;
      const state = await env.DB.prepare("SELECT current_max, sets_json, rotate_index FROM anchor_state WHERE exercise_key = ?").bind(key).first();
      if (!state) continue;
      const advanced = advanceRedistribution({
        current_max: state.current_max,
        sets: JSON.parse(state.sets_json),
        rotate_index: state.rotate_index,
      });
      await env.DB.prepare("UPDATE anchor_state SET sets_json = ?, rotate_index = ?, updated_at = ? WHERE exercise_key = ?")
        .bind(JSON.stringify(advanced.sets), advanced.rotate_index, now, key).run();
      await env.DB.prepare("INSERT OR IGNORE INTO anchor_advances (session_id, exercise_key) VALUES (?, ?)").bind(s.id, key).run();
    }
  }

  const anchor_state = (await env.DB.prepare("SELECT * FROM anchor_state").all()).results;
  return json({ ok: true, applied: sessions.length, anchor_state });
}

// GET /api/coverage?since=<iso> — which major muscle groups have been trained
// this week (default: since the start of the current week, Monday 00:00 UTC).
async function getCoverage(url, env) {
  const since = url.searchParams.get("since") || startOfWeekISO();
  const { results } = await env.DB.prepare(
    "SELECT sl.exercise_key FROM set_logs sl JOIN sessions s ON s.id = sl.session_id WHERE s.date >= ?"
  ).bind(since).all();
  return json({ since, ...weeklyCoverage(results) });
}

function startOfWeekISO(d = new Date()) {
  const x = new Date(d);
  const dayFromMonday = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - dayFromMonday);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString();
}

// GET /api/export — entire history as an array of OpenWeight WorkoutLogs.
async function getExport(env) {
  const sessions = (await env.DB.prepare("SELECT * FROM sessions ORDER BY date").all()).results;
  const out = [];
  for (const s of sessions) {
    const logs = (await env.DB.prepare("SELECT * FROM set_logs WHERE session_id = ? ORDER BY set_index").bind(s.id).all()).results;
    out.push(sessionToWorkoutLog(s, logs));
  }
  return json(out);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}
