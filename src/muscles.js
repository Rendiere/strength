// Weekly muscle-group coverage.
//
// MAP is the one judgment call — Ren to sanity-check. Each program exercise_key
// maps to the major muscle groups it meaningfully trains. GROUPS is the canonical
// list we check for "did I hit everything this week?". Core is intentionally left
// out of v0 (the program doesn't train it directly — including it would show a
// permanent false gap). Swim + yoga aren't logged in this app, so coverage here
// reflects STRENGTH sessions only.

export const GROUPS = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps",
  "Quads", "Hamstrings", "Glutes", "Calves",
];

export const MAP = {
  // legs / rehab spine
  dl_squat: ["Quads", "Glutes"],
  sl_calf_raise: ["Calves"],
  rdl: ["Hamstrings", "Glutes"],
  lunges: ["Quads", "Glutes"],
  glute_bridge: ["Glutes"],
  penguin_march: ["Calves"],
  tibialis_raise: ["Calves"],
  ecc_calf_drop: ["Calves"],
  // push
  pushup: ["Chest", "Triceps", "Shoulders"],
  kb_ohp: ["Shoulders", "Triceps"],
  kb_floor_press: ["Chest", "Triceps"],
  dips: ["Chest", "Triceps"],
  // pull
  chinup: ["Back", "Biceps"],
  kb_row: ["Back", "Biceps"],
  ring_curls: ["Biceps"],
  band_face_pull: ["Back", "Shoulders"],
};

/**
 * Which major muscle groups have been trained this week, and which are still
 * missing. Input = the set_log rows logged within the week.
 *
 * @param {Array<{exercise_key:string}>} setLogs
 * @returns {{covered:string[], missing:string[], hit:number, total:number, byGroup:Object<string,number>}}
 */
export function weeklyCoverage(setLogs) {
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  for (const row of setLogs || []) {
    const groups = MAP[row.exercise_key] || [];
    for (const g of groups) {
      if (g in byGroup) byGroup[g] += 1;
    }
  }
  const covered = GROUPS.filter((g) => byGroup[g] > 0);
  const missing = GROUPS.filter((g) => byGroup[g] === 0);
  return { covered, missing, hit: covered.length, total: GROUPS.length, byGroup };
}
