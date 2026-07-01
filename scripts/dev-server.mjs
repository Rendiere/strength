// Local dev/preview server — runs the SAME Worker (src/worker.js) over a
// node:sqlite-backed D1 shim and serves public/ statically.
//
// Why this exists: wrangler's local workerd runtime OOMs on this Raspberry Pi
// (48-bit VSS / tcmalloc). This harness gives a faithful local preview without
// workerd. Production still runs the unchanged worker on Cloudflare.
//
//   node --experimental-sqlite strength/scripts/dev-server.mjs [port]
//
// Data persists in strength/.dev.db (gitignored).

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";
import worker from "../src/worker.js";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 8787);

// ── D1 shim over node:sqlite ────────────────────────────────────────────────
class D1Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new D1Stmt(this.db, this.sql, params); }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params), success: true }; }
  async first(col) { const r = this.db.prepare(this.sql).get(...this.params); return r == null ? null : (col ? r[col] : r); }
  async run() { const i = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: i.changes } }; }
}
class D1 { constructor(db) { this.db = db; } prepare(sql) { return new D1Stmt(this.db, sql); } }

const dbPath = join(root, ".dev.db");
const fresh = !existsSync(dbPath);
const db = new DatabaseSync(dbPath);
if (fresh) {
  db.exec(readFileSync(join(root, "schema.sql"), "utf8"));
  db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  console.log("seeded fresh dev db at", dbPath);
}

// ── Static assets binding ───────────────────────────────────────────────────
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const ASSETS = {
  async fetch(request) {
    let p = new URL(request.url).pathname;
    if (p === "/") p = "/index.html";
    const file = join(root, "public", p);
    if (!file.startsWith(join(root, "public")) || !existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(readFileSync(file), { status: 200, headers: { "content-type": MIME[extname(file)] || "application/octet-stream" } });
  },
};

const env = { DB: new D1(db), ASSETS };

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request("http://localhost:" + port + req.url, {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const response = await worker.fetch(request, env);
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`strength dev server → http://localhost:${port}`));
