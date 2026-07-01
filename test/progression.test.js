import { describe, it, expect } from "vitest";
import { advanceRedistribution, retestMax, loadedShouldBump } from "../src/progression.js";

describe("advanceRedistribution", () => {
  it("shifts +1 onto rotate set, -1 off last, preserves total", () => {
    const r = advanceRedistribution({ current_max: 20, sets: [14, 13, 13], rotate_index: 0 });
    expect(r.sets).toEqual([15, 13, 12]);
    expect(r.sets.reduce((a, b) => a + b, 0)).toBe(40);
    expect(r.rotate_index).toBe(1);
  });

  it("drops the last set when it reaches 0", () => {
    const r = advanceRedistribution({ current_max: 1, sets: [3, 0, 1], rotate_index: 0 });
    // -1 off last (1->0) => dropped; +1 onto set 0
    expect(r.sets).toEqual([4, 0]);
  });

  it("wraps rotate_index within remaining sets", () => {
    const r = advanceRedistribution({ current_max: 20, sets: [15, 13, 12], rotate_index: 2 });
    expect(r.rotate_index).toBe(0);
  });

  it("clamps an out-of-range rotate_index", () => {
    const r = advanceRedistribution({ current_max: 20, sets: [15, 13, 12], rotate_index: 5 });
    // 5 % 3 = 2 -> +1 and -1 both on last set (net 0)
    expect(r.sets).toEqual([15, 13, 12]);
    expect(r.rotate_index).toBe(0);
  });
});

describe("retestMax", () => {
  it("distributes 2x max across 3 sets, remainder early", () => {
    expect(retestMax(22, 3)).toEqual({ current_max: 22, sets: [15, 15, 14], rotate_index: 0 });
  });

  it("defaults to 3 sets", () => {
    expect(retestMax(20).sets).toEqual([14, 13, 13]);
  });
});

describe("loadedShouldBump", () => {
  it("true only when all sets hit rep_high", () => {
    expect(loadedShouldBump({ sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }], rep_high: 10 })).toBe(true);
    expect(loadedShouldBump({ sets: [{ reps: 10 }, { reps: 9 }, { reps: 10 }], rep_high: 10 })).toBe(false);
  });

  it("false on empty set list", () => {
    expect(loadedShouldBump({ sets: [], rep_high: 10 })).toBe(false);
  });
});
