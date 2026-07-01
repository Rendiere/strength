import { describe, it, expect } from "vitest";
import { weeklyCoverage, GROUPS, MAP } from "../src/muscles.js";

describe("weeklyCoverage", () => {
  it("reports all groups missing when nothing logged", () => {
    const c = weeklyCoverage([]);
    expect(c.hit).toBe(0);
    expect(c.missing).toEqual(GROUPS);
  });

  it("marks groups hit from logged exercises", () => {
    const c = weeklyCoverage([
      { exercise_key: "pushup" }, // Chest, Triceps, Shoulders
      { exercise_key: "chinup" }, // Back, Biceps
      { exercise_key: "dl_squat" }, // Quads, Glutes
    ]);
    expect(c.covered.sort()).toEqual(["Back", "Biceps", "Chest", "Glutes", "Quads", "Shoulders", "Triceps"].sort());
    expect(c.missing.sort()).toEqual(["Calves", "Hamstrings"].sort());
  });

  it("a full Leg A + Leg B + Upper week covers everything", () => {
    const week = [
      "dl_squat", "sl_calf_raise", "rdl", "lunges", "glute_bridge", "pushup", "kb_ohp", // leg A
      "chinup", "kb_row", // leg B pull
      "kb_floor_press", "dips", "ring_curls", "band_face_pull", // upper +1
    ].map((k) => ({ exercise_key: k }));
    const c = weeklyCoverage(week);
    expect(c.missing).toEqual([]);
    expect(c.hit).toBe(c.total);
  });

  it("every canonical group is reachable by at least one mapped exercise", () => {
    const reachable = new Set(Object.values(MAP).flat());
    for (const g of GROUPS) expect(reachable.has(g)).toBe(true);
  });
});
