// Progression engine — pure functions, no I/O.
// The one signal that matters: am I still progressively overloading?

/**
 * Bodyweight 2×-max redistribution (Ren's rule).
 * Every session total = 2× current max, distributed across N sets.
 * Each session: shift +1 onto the rotating set, −1 off the LAST set.
 * Drop the last set when it hits 0. Rotate index advances (mod remaining sets).
 *
 * @param {{current_max:number, sets:number[], rotate_index:number}} state
 * @returns {{sets:number[], rotate_index:number}}
 */
export function advanceRedistribution({ current_max, sets, rotate_index }) {
  const next = sets.slice();
  const n = next.length;
  if (n === 0) return { sets: [], rotate_index: 0 };

  const ri = ((rotate_index % n) + n) % n; // clamp into range
  const last = n - 1;

  next[ri] += 1; // shift up onto the rotating set
  next[last] -= 1; // peel one off the tail

  if (next[last] <= 0) {
    next[last] = 0;
    next.pop(); // drop the spent tail set
  }

  const remaining = next.length || 1;
  return { sets: next, rotate_index: (ri + 1) % remaining };
}

/**
 * Re-test bodyweight max (Wk 5) and regenerate the redistribution table.
 * Distributes 2×newMax across nSets as evenly as possible, remainder on the
 * earliest sets.
 *
 * @param {number} newMax
 * @param {number} [nSets=3]
 * @returns {{current_max:number, sets:number[], rotate_index:number}}
 */
export function retestMax(newMax, nSets = 3) {
  const total = 2 * newMax;
  const base = Math.floor(total / nSets);
  const rem = total % nSets;
  const sets = Array.from({ length: nSets }, (_, i) => base + (i < rem ? 1 : 0));
  return { current_max: newMax, sets, rotate_index: 0 };
}

/**
 * Loaded-lift progression trigger: bump load/vest/tempo only when EVERY logged
 * set reached the top of the rep range.
 *
 * @param {{sets:{reps:number}[], rep_high:number}} arg
 * @returns {boolean}
 */
export function loadedShouldBump({ sets, rep_high }) {
  if (!sets || sets.length === 0) return false;
  return sets.every((s) => Number(s.reps) >= rep_high);
}
