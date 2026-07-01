// Strength PWA — one screen. Online-first; offline saves queue and auto-flush.

const QUEUE_KEY = "strength_queue";
const RESTORE_KEY = "strength_restored";

const els = {
  blocks: document.getElementById("blocks"),
  status: document.getElementById("status"),
  date: document.getElementById("date"),
  save: document.getElementById("save"),
  sync: document.getElementById("sync"),
  types: document.getElementById("types"),
  coverage: document.getElementById("coverage"),
};

let currentType = defaultType();
let currentBlocks = [];

function defaultType() {
  // Monday → Leg A (legs + push); otherwise still default to Leg A, user can switch.
  return "leg_a";
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function setStatus(msg, cls = "") {
  els.status.textContent = msg;
  els.status.className = "status " + cls;
}

// ── Offline queue ───────────────────────────────────────────────────────────
function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function writeQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
function enqueue(payload) { const q = readQueue(); q.push(payload); writeQueue(q); }

async function flushQueue() {
  let q = readQueue();
  if (!q.length) return true;
  setStatus(`Syncing ${q.length} pending…`);
  while (q.length) {
    try {
      const res = await fetch("/api/push", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(q[0]),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      q.shift();
      writeQueue(q);
    } catch (err) {
      setStatus(`${q.length} pending — offline`, "warn");
      return false;
    }
  }
  setStatus("All synced", "ok");
  return true;
}

// ── Load + render ───────────────────────────────────────────────────────────
async function loadToday(type) {
  currentType = type;
  for (const b of els.types.querySelectorAll("button")) b.classList.toggle("active", b.dataset.type === type);
  setStatus("Loading…");
  try {
    const res = await fetch(`/api/today?type=${encodeURIComponent(type)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    currentBlocks = data.blocks;
    render(data.blocks);
    loadCoverage();
    setStatus(readQueue().length ? `${readQueue().length} pending` : "Ready", readQueue().length ? "warn" : "ok");
  } catch (err) {
    setStatus("Offline — can't load plan. Pending saves are kept.", "warn");
    els.blocks.innerHTML = `<div class="block"><div class="note">No connection. Your saved sessions are queued and will sync automatically.</div></div>`;
  }
}

// ── Weekly muscle-group coverage ────────────────────────────────────────────
async function loadCoverage() {
  try {
    const res = await fetch("/api/coverage");
    if (!res.ok) return;
    const c = await res.json();
    const full = c.missing.length === 0;
    const chips = [...c.covered.map((g) => `<span class="chip hit">${g}</span>`),
                   ...c.missing.map((g) => `<span class="chip">${g}</span>`)].join("");
    els.coverage.innerHTML = `
      <div class="cov-head">
        <span class="cov-title">This week</span>
        <span class="cov-count ${full ? "full" : ""}">${c.hit}/${c.total} groups${full ? " · full body ✓" : ""}</span>
      </div>
      <div class="chips">${chips}</div>`;
  } catch { /* offline — leave whatever's shown */ }
}

function render(blocks) {
  els.blocks.innerHTML = "";
  for (const b of blocks) {
    const block = document.createElement("section");
    block.className = "block";
    block.dataset.key = b.exercise_key;
    block.dataset.name = b.name;
    block.dataset.kind = b.kind;

    const head = document.createElement("div");
    head.className = "head";
    const anchorHint = b.is_anchor ? ` · max ${b.current_max}` : "";
    head.innerHTML = `<span class="name">${b.name}</span><span class="tag ${b.kind}">${b.kind}${anchorHint}</span>`;
    block.appendChild(head);

    if (b.load_note) {
      const note = document.createElement("div");
      note.className = "note";
      note.textContent = b.load_note;
      block.appendChild(note);
    }

    const sets = document.createElement("div");
    sets.className = "sets";
    const showWeight = b.sets.some((s) => s.weight_kg != null);
    b.sets.forEach((s) => {
      const row = document.createElement("div");
      row.className = "set";
      row.style.gridTemplateColumns = showWeight ? "22px 1fr 1fr" : "22px 1fr";
      const repsField = `
        <div class="field">
          <label>reps <span class="target">/ ${s.target_reps ?? "—"}</span></label>
          <input type="number" inputmode="numeric" min="0" class="reps" value="${s.target_reps ?? ""}" />
        </div>`;
      const weightField = showWeight ? `
        <div class="field">
          <label>kg</label>
          <input type="number" inputmode="decimal" min="0" step="0.5" class="weight" value="${s.weight_kg ?? ""}" />
        </div>` : "";
      row.innerHTML = `<span class="idx">${s.set_index + 1}</span>${repsField}${weightField}`;
      sets.appendChild(row);
    });
    block.appendChild(sets);
    els.blocks.appendChild(block);
  }
}

// ── Save ────────────────────────────────────────────────────────────────────
function collectPayload() {
  const sessionId = uuid();
  const now = new Date().toISOString();
  const session = { id: sessionId, date: now, session_type: currentType, created_at: now };
  const set_logs = [];
  for (const block of els.blocks.querySelectorAll(".block")) {
    const { key, name, kind } = block.dataset;
    if (!key) continue;
    block.querySelectorAll(".set").forEach((row, i) => {
      const repsEl = row.querySelector(".reps");
      const weightEl = row.querySelector(".weight");
      const reps = repsEl && repsEl.value !== "" ? parseInt(repsEl.value, 10) : null;
      if (reps == null || isNaN(reps)) return; // only log sets actually performed
      const weight_kg = weightEl && weightEl.value !== "" ? parseFloat(weightEl.value) : null;
      set_logs.push({ id: uuid(), session_id: sessionId, exercise_key: key, name, kind, set_index: i, reps, weight_kg, created_at: now });
    });
  }
  return { sessions: [session], set_logs };
}

async function save() {
  const payload = collectPayload();
  if (!payload.set_logs.length) { setStatus("Nothing logged yet — enter some reps.", "warn"); return; }
  els.save.disabled = true;
  enqueue(payload);
  const ok = await flushQueue();
  els.save.disabled = false;
  if (ok) {
    setStatus("Session saved ✓ — targets advanced", "ok");
    loadToday(currentType); // pull advanced anchor targets
  } else {
    setStatus("Saved offline — will sync when back online", "warn");
  }
}

// ── First-open restore (data comes back after a reinstall) ───────────────────
async function restoreOnFirstOpen() {
  if (localStorage.getItem(RESTORE_KEY)) return;
  try {
    const res = await fetch("/api/pull");
    if (res.ok) localStorage.setItem(RESTORE_KEY, new Date().toISOString());
  } catch { /* offline — try again next open */ }
}

// ── Wire up ─────────────────────────────────────────────────────────────────
els.types.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-type]");
  if (btn) loadToday(btn.dataset.type);
});
els.save.addEventListener("click", save);
els.sync.addEventListener("click", async () => { await flushQueue(); loadToday(currentType); });
window.addEventListener("online", () => { setStatus("Back online — syncing…"); flushQueue(); });

els.date.textContent = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

(async function init() {
  await restoreOnFirstOpen();
  await flushQueue();
  await loadToday(currentType);
})();
