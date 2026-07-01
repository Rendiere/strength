import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// node:sqlite is a builtin the bundler can't statically resolve; load it at runtime.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../src/worker.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal shim mapping node:sqlite to the Cloudflare D1 prepared-statement API.
class D1Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new D1Stmt(this.db, this.sql, params); }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params), success: true }; }
  async first(col) {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (row == null) return null;
    return col ? row[col] : row;
  }
  async run() { const i = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: i.changes } }; }
}
class D1 { constructor(db) { this.db = db; } prepare(sql) { return new D1Stmt(this.db, sql); } }

let env;
beforeEach(() => {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(join(root, "schema.sql"), "utf8"));
  db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  env = { DB: new D1(db), ASSETS: { fetch: async () => new Response("asset", { status: 200 }) } };
});

const call = (path, init) => worker.fetch(new Request("http://x" + path, init), env);

describe("worker API", () => {
  it("health", async () => {
    expect(await (await call("/api/health")).json()).toEqual({ ok: true });
  });

  it("today/leg_a pre-fills the pushup anchor and includes the rehab spine", async () => {
    const body = await (await call("/api/today?type=leg_a")).json();
    expect(body.session_type).toBe("leg_a");
    const pushup = body.blocks.find((b) => b.exercise_key === "pushup");
    expect(pushup.is_anchor).toBe(true);
    expect(pushup.sets.map((s) => s.target_reps)).toEqual([14, 13, 13]);
    expect(body.blocks.some((b) => b.exercise_key === "dl_squat" && b.kind === "rehab")).toBe(true);
    const ohp = body.blocks.find((b) => b.exercise_key === "kb_ohp");
    expect(ohp.sets).toHaveLength(3);
    expect(ohp.sets[0].weight_kg).toBe(18);
  });

  it("push logs a session and advances the pushup anchor; pull reflects it", async () => {
    const session = { id: "s1", date: "2026-06-29T18:00:00Z", session_type: "leg_a" };
    const set_logs = [0, 1, 2].map((i) => ({
      id: "p" + i, session_id: "s1", exercise_key: "pushup", name: "Push-ups",
      kind: "bodyweight", set_index: i, reps: [14, 13, 13][i], weight_kg: null,
    }));
    const res = await (await call("/api/push", { method: "POST", body: JSON.stringify({ sessions: [session], set_logs }) })).json();
    expect(res.ok).toBe(true);
    const pushup = res.anchor_state.find((a) => a.exercise_key === "pushup");
    expect(JSON.parse(pushup.sets_json)).toEqual([15, 13, 12]);

    const pull = await (await call("/api/pull")).json();
    expect(pull.sessions).toHaveLength(1);
    expect(pull.set_logs).toHaveLength(3);

    const today = await (await call("/api/today?type=leg_a")).json();
    expect(today.blocks.find((b) => b.exercise_key === "pushup").sets.map((s) => s.target_reps)).toEqual([15, 13, 12]);
  });

  it("re-pushing the same session does not double-advance the anchor (idempotent)", async () => {
    const session = { id: "s1", date: "2026-06-29T18:00:00Z", session_type: "leg_a" };
    const set_logs = [{ id: "p0", session_id: "s1", exercise_key: "pushup", name: "Push-ups", kind: "bodyweight", set_index: 0, reps: 14, weight_kg: null }];
    const payload = { method: "POST", body: JSON.stringify({ sessions: [session], set_logs }) };
    await call("/api/push", payload);
    const second = await (await call("/api/push", payload)).json();
    const pushup = second.anchor_state.find((a) => a.exercise_key === "pushup");
    expect(JSON.parse(pushup.sets_json)).toEqual([15, 13, 12]); // advanced once, not twice
  });

  it("coverage reports muscle groups hit this week and what's missing", async () => {
    const now = new Date().toISOString();
    const session = { id: "s1", date: now, session_type: "leg_a" };
    const set_logs = [
      { id: "c1", session_id: "s1", exercise_key: "pushup", name: "Push-ups", kind: "bodyweight", set_index: 0, reps: 14, weight_kg: null },
      { id: "c2", session_id: "s1", exercise_key: "dl_squat", name: "DL squat", kind: "rehab", set_index: 0, reps: 10, weight_kg: 18 },
    ];
    await call("/api/push", { method: "POST", body: JSON.stringify({ sessions: [session], set_logs }) });
    const cov = await (await call("/api/coverage")).json();
    expect(cov.covered).toEqual(expect.arrayContaining(["Chest", "Triceps", "Shoulders", "Quads", "Glutes"]));
    expect(cov.missing).toEqual(expect.arrayContaining(["Back", "Biceps", "Hamstrings", "Calves"]));
    expect(cov.hit + cov.missing.length).toBe(cov.total);
  });

  it("export returns OpenWeight WorkoutLogs", async () => {
    const session = { id: "s1", date: "2026-06-29T18:00:00Z", session_type: "leg_a" };
    const set_logs = [{ id: "o1", session_id: "s1", exercise_key: "kb_ohp", name: "KB overhead press", kind: "loaded", set_index: 0, reps: 8, weight_kg: 18 }];
    await call("/api/push", { method: "POST", body: JSON.stringify({ sessions: [session], set_logs }) });
    const out = await (await call("/api/export")).json();
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].$schema).toContain("openweight.dev");
    expect(out[0].exercises[0].sets[0]).toEqual({ reps: 8, weight: 18, unit: "kg" });
  });
});
