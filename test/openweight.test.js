import { describe, it, expect } from "vitest";
import { sessionToWorkoutLog, workoutLogToRows } from "../src/openweight.js";

const session = { id: "s1", date: "2026-06-29T18:00:00Z", session_type: "leg_a", notes: null };
const setLogs = [
  { id: "a1", session_id: "s1", exercise_key: "pushup", name: "Push-ups", kind: "bodyweight", set_index: 0, reps: 14, weight_kg: null },
  { id: "a2", session_id: "s1", exercise_key: "pushup", name: "Push-ups", kind: "bodyweight", set_index: 1, reps: 13, weight_kg: null },
  { id: "b1", session_id: "s1", exercise_key: "kb_ohp", name: "KB overhead press", kind: "loaded", set_index: 0, reps: 8, weight_kg: 18 },
];

describe("sessionToWorkoutLog", () => {
  it("produces an OpenWeight WorkoutLog grouped by exercise", () => {
    const log = sessionToWorkoutLog(session, setLogs);
    expect(log.$schema).toBe("https://openweight.dev/schemas/workout-log.schema.json");
    expect(log.date).toBe("2026-06-29T18:00:00Z");
    expect(log.exercises).toHaveLength(2);

    const pushups = log.exercises.find((e) => e.exercise.name === "Push-ups");
    expect(pushups.sets).toEqual([{ reps: 14 }, { reps: 13 }]); // no weight key for bodyweight

    const ohp = log.exercises.find((e) => e.exercise.name === "KB overhead press");
    expect(ohp.sets).toEqual([{ reps: 8, weight: 18, unit: "kg" }]);
  });
});

describe("workoutLogToRows", () => {
  it("round-trips reps and weights back to rows", () => {
    const log = sessionToWorkoutLog(session, setLogs);
    const { session: s, set_logs: rows } = workoutLogToRows(log);
    expect(s.date).toBe(session.date);
    expect(rows).toHaveLength(3);
    const ohp = rows.find((r) => r.name === "KB overhead press");
    expect(ohp.reps).toBe(8);
    expect(ohp.weight_kg).toBe(18);
    const pu = rows.filter((r) => r.name === "Push-ups");
    expect(pu.map((r) => r.reps)).toEqual([14, 13]);
    expect(pu[0].weight_kg).toBeNull();
  });
});
