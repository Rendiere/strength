// OpenWeight WorkoutLog mapping (https://openweight.dev).
// WorkoutLog = { $schema, date, exercises: [{ exercise:{name}, sets:[{reps, weight?, unit?}] }] }

const SCHEMA = "https://openweight.dev/schemas/workout-log.schema.json";

/**
 * One logged session + its set rows -> a single OpenWeight WorkoutLog.
 * Sets are grouped by exercise (first appearance order) and ordered by set_index.
 *
 * @param {{id?:string, date:string, session_type?:string, notes?:string}} session
 * @param {Array<{exercise_key:string,name:string,set_index:number,reps:number,weight_kg:number|null}>} setLogs
 */
export function sessionToWorkoutLog(session, setLogs) {
  const order = [];
  const byKey = new Map();
  for (const r of [...setLogs].sort((a, b) => a.set_index - b.set_index)) {
    if (!byKey.has(r.exercise_key)) {
      byKey.set(r.exercise_key, { exercise: { name: r.name }, sets: [] });
      order.push(r.exercise_key);
    }
    const set = { reps: r.reps };
    if (r.weight_kg != null) {
      set.weight = r.weight_kg;
      set.unit = "kg";
    }
    byKey.get(r.exercise_key).sets.push(set);
  }
  return {
    $schema: SCHEMA,
    date: session.date,
    exercises: order.map((k) => byKey.get(k)),
  };
}

/**
 * Inverse: an OpenWeight WorkoutLog -> { session, set_logs } rows.
 * Ids are generated when absent. exercise_key is derived from the name slug.
 *
 * @param {{date:string, exercises:Array<{exercise:{name:string}, sets:Array<{reps:number, weight?:number}>}>}} log
 */
export function workoutLogToRows(log) {
  const sessionId = log.id || cryptoId();
  const session = {
    id: sessionId,
    date: log.date,
    session_type: log.session_type || null,
    notes: log.notes || null,
  };
  const set_logs = [];
  for (const ex of log.exercises || []) {
    const name = ex.exercise?.name || "";
    const key = slug(name);
    ex.sets.forEach((s, i) => {
      set_logs.push({
        id: cryptoId(),
        session_id: sessionId,
        exercise_key: key,
        name,
        kind: s.weight != null ? "loaded" : "bodyweight",
        set_index: i,
        reps: s.reps,
        weight_kg: s.weight != null ? s.weight : null,
      });
    });
  }
  return { session, set_logs };
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function cryptoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2);
}
