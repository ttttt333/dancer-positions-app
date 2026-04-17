import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { randomBytes, createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync, createReadStream } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-in-production";
const PORT = Number(process.env.PORT) || 3001;
const APP_BASE = process.env.APP_BASE || "http://127.0.0.1:5173";

const dbPath = join(__dirname, "data.sqlite");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS org_admins (
    org_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (org_id, user_id),
    FOREIGN KEY (org_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS org_members (
    org_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    approved_at TEXT NOT NULL,
    PRIMARY KEY (org_id, user_id),
    FOREIGN KEY (org_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS membership_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    decided_at TEXT,
    decided_by INTEGER,
    FOREIGN KEY (org_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

try {
  db.exec(
    "ALTER TABLE users ADD COLUMN entitlement_lifetime INTEGER NOT NULL DEFAULT 0"
  );
} catch {
  /* column exists */
}

db.exec(`
  CREATE TABLE IF NOT EXISTS audio_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER,
    mime TEXT,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS approval_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES membership_requests(id)
  );
`);

const countOrgs = db.prepare("SELECT COUNT(*) AS c FROM organizations").get();
if (countOrgs.c === 0) {
  db.prepare(
    "INSERT INTO organizations (name, created_at) VALUES (?, ?)"
  ).run("サンプル協会", new Date().toISOString());
}

const uploadsRoot = join(__dirname, "data", "uploads");
if (!existsSync(uploadsRoot)) mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uid = String(req.userId || "0");
    const dir = join(uploadsRoot, uid);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "bin").slice(0, 8);
    cb(null, `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 },
});

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "20mb" }));

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) {
    req.userId = null;
    return next();
  }
  try {
    const p = jwt.verify(token, JWT_SECRET);
    req.userId = Number(p.sub);
    next();
  } catch {
    req.userId = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: "ログインが必要です" });
  }
  next();
}

function hashToken(t) {
  return createHash("sha256").update(t).digest("hex");
}

function approveMembershipRequest(requestId, decidedBy) {
  const row = db
    .prepare("SELECT * FROM membership_requests WHERE id = ?")
    .get(requestId);
  if (!row || row.status !== "pending") return { ok: false, error: "not_pending" };
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE membership_requests SET status = 'approved', decided_at = ?, decided_by = ?
     WHERE id = ?`
  ).run(now, decidedBy, requestId);
  db.prepare(
    `INSERT OR REPLACE INTO org_members (org_id, user_id, approved_at)
     VALUES (?, ?, ?)`
  ).run(row.org_id, row.user_id, now);
  db.prepare("DELETE FROM approval_tokens WHERE request_id = ?").run(requestId);
  return { ok: true };
}

app.post("/api/auth/register", async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || password.length < 6) {
    return res
      .status(400)
      .json({ error: "メールと6文字以上のパスワードが必要です" });
  }
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) {
    return res.status(409).json({ error: "このメールは既に登録されています" });
  }
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)"
    )
    .run(email, hash, now);
  const userId = Number(info.lastInsertRowid);
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const demoOrg = db
    .prepare("SELECT id FROM organizations ORDER BY id LIMIT 1")
    .get();
  if (demoOrg && userCount === 1) {
    db.prepare(
      "INSERT OR IGNORE INTO org_admins (org_id, user_id) VALUES (?, ?)"
    ).run(demoOrg.id, userId);
    console.log(
      `[auth] 最初のユーザー ${email} を協会 id=${demoOrg.id} の管理者にしました`
    );
  }
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: userId, email } });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: "メールまたはパスワードが違います" });
  }
  const token = jwt.sign({ sub: row.id }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { id: row.id, email: row.email } });
});

app.get("/api/auth/me", authMiddleware, requireAuth, (req, res) => {
  const user = db
    .prepare(
      "SELECT id, email, COALESCE(entitlement_lifetime,0) AS entitlement_lifetime FROM users WHERE id = ?"
    )
    .get(req.userId);
  if (!user) return res.status(404).json({ error: "ユーザーが見つかりません" });
  const adminRows = db
    .prepare(
      `SELECT o.id, o.name FROM org_admins a
       JOIN organizations o ON o.id = a.org_id WHERE a.user_id = ?`
    )
    .all(req.userId);
  const memberRows = db
    .prepare(
      `SELECT o.id, o.name FROM org_members m
       JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ?`
    )
    .all(req.userId);
  res.json({
    user,
    adminOrganizations: adminRows,
    memberOrganizations: memberRows,
  });
});

/** Stripe 等と接続する前のプレースホルダ（買い切りフラグを手動で立てる想定） */
app.post(
  "/api/billing/placeholder-purchase",
  authMiddleware,
  requireAuth,
  (req, res) => {
    db.prepare(
      "UPDATE users SET entitlement_lifetime = 1 WHERE id = ?"
    ).run(req.userId);
    res.json({ ok: true, message: "開発用: 買い切りフラグを有効にしました" });
  }
);

app.get("/api/organizations", authMiddleware, requireAuth, (req, res) => {
  const rows = db
    .prepare("SELECT id, name FROM organizations ORDER BY id")
    .all();
  res.json(rows);
});

app.post("/api/membership-requests", authMiddleware, requireAuth, (req, res) => {
  const orgId = Number(req.body?.orgId);
  if (!orgId) return res.status(400).json({ error: "orgId が必要です" });
  const org = db.prepare("SELECT id FROM organizations WHERE id = ?").get(orgId);
  if (!org) return res.status(404).json({ error: "協会が見つかりません" });
  const dup = db
    .prepare(
      `SELECT id FROM membership_requests
       WHERE org_id = ? AND user_id = ? AND status = 'pending'`
    )
    .get(orgId, req.userId);
  if (dup) {
    return res.status(409).json({ error: "既に申請済みです" });
  }
  const member = db
    .prepare(
      "SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?"
    )
    .get(orgId, req.userId);
  if (member) {
    return res.status(409).json({ error: "既に所属しています" });
  }
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO membership_requests (org_id, user_id, status, created_at)
       VALUES (?, ?, 'pending', ?)`
    )
    .run(orgId, req.userId, now);
  const requestId = Number(info.lastInsertRowid);
  const plain = randomBytes(24).toString("hex");
  const th = hashToken(plain);
  const exp = new Date(Date.now() + 7 * 864e5).toISOString();
  db.prepare("DELETE FROM approval_tokens WHERE request_id = ?").run(
    requestId
  );
  db.prepare(
    `INSERT INTO approval_tokens (request_id, token_hash, expires_at)
     VALUES (?, ?, ?)`
  ).run(requestId, th, exp);
  const approveUrl = `${APP_BASE}/approve-membership?token=${plain}`;
  const admins = db
    .prepare(
      `SELECT u.email FROM org_admins a
       JOIN users u ON u.id = a.user_id WHERE a.org_id = ?`
    )
    .all(orgId);
  console.log(
    `[membership] 申請 id=${requestId} — 管理者向け承認リンク（メール本文に使用）:\n${approveUrl}\n対象管理者: ${admins.map((a) => a.email).join(", ")}`
  );
  res.json({
    id: requestId,
    status: "pending",
    devApprovalUrl: approveUrl,
  });
});

app.get("/api/public/membership-approve", (req, res) => {
  const plain = String(req.query.token || "");
  if (!plain) return res.status(400).json({ error: "token が必要です" });
  const th = hashToken(plain);
  const row = db
    .prepare(
      `SELECT t.request_id, t.expires_at FROM approval_tokens t WHERE t.token_hash = ?`
    )
    .get(th);
  if (!row) return res.status(404).json({ error: "無効なトークン" });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ error: "トークンの有効期限切れ" });
  }
  const r = approveMembershipRequest(row.request_id, null);
  if (!r.ok) return res.status(400).json({ error: "承認できません" });
  res.json({ ok: true, message: "承認しました" });
});

app.get(
  "/api/membership-requests/pending",
  authMiddleware,
  requireAuth,
  (req, res) => {
    const orgId = Number(req.query.orgId);
    if (!orgId) return res.status(400).json({ error: "orgId クエリが必要です" });
    const isAdmin = db
      .prepare(
        "SELECT 1 FROM org_admins WHERE org_id = ? AND user_id = ?"
      )
      .get(orgId, req.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: "この協会の管理者のみ閲覧できます" });
    }
    const rows = db
      .prepare(
        `SELECT r.id, r.user_id, r.created_at, u.email
         FROM membership_requests r
         JOIN users u ON u.id = r.user_id
         WHERE r.org_id = ? AND r.status = 'pending'
         ORDER BY r.created_at`
      )
      .all(orgId);
    res.json(rows);
  }
);

app.post(
  "/api/membership-requests/:id/approve",
  authMiddleware,
  requireAuth,
  (req, res) => {
    const id = Number(req.params.id);
    const row = db
      .prepare("SELECT * FROM membership_requests WHERE id = ?")
      .get(id);
    if (!row || row.status !== "pending") {
      return res.status(404).json({ error: "申請が見つかりません" });
    }
    const isAdmin = db
      .prepare(
        "SELECT 1 FROM org_admins WHERE org_id = ? AND user_id = ?"
      )
      .get(row.org_id, req.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: "承認権限がありません" });
    }
    const r = approveMembershipRequest(id, req.userId);
    if (!r.ok) return res.status(400).json({ error: "承認できません" });
    res.json({ ok: true });
  }
);

app.post(
  "/api/membership-requests/:id/reject",
  authMiddleware,
  requireAuth,
  (req, res) => {
    const id = Number(req.params.id);
    const row = db
      .prepare("SELECT * FROM membership_requests WHERE id = ?")
      .get(id);
    if (!row || row.status !== "pending") {
      return res.status(404).json({ error: "申請が見つかりません" });
    }
    const isAdmin = db
      .prepare(
        "SELECT 1 FROM org_admins WHERE org_id = ? AND user_id = ?"
      )
      .get(row.org_id, req.userId);
    if (!isAdmin) {
      return res.status(403).json({ error: "権限がありません" });
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE membership_requests SET status = 'rejected', decided_at = ?, decided_by = ?
       WHERE id = ?`
    ).run(now, req.userId, id);
    db.prepare("DELETE FROM approval_tokens WHERE request_id = ?").run(id);
    res.json({ ok: true });
  }
);

app.post(
  "/api/audio/upload",
  authMiddleware,
  requireAuth,
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "file が必要です" });
    const projectId = req.body?.projectId
      ? Number(req.body.projectId)
      : null;
    const mime = req.file.mimetype || "application/octet-stream";
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO audio_assets (user_id, project_id, mime, path, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(req.userId, projectId, mime, req.file.path, now);
    res.json({ id: Number(info.lastInsertRowid), mime });
  }
);

app.get("/api/audio/:id", authMiddleware, requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT * FROM audio_assets WHERE id = ? AND user_id = ?")
    .get(id, req.userId);
  if (!row) return res.status(404).json({ error: "見つかりません" });
  if (!existsSync(row.path)) return res.status(404).json({ error: "ファイルがありません" });
  res.setHeader("Content-Type", row.mime || "application/octet-stream");
  createReadStream(row.path).pipe(res);
});

app.get("/api/projects", authMiddleware, requireAuth, (req, res) => {
  const rows = db
    .prepare(
      "SELECT id, name, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
    )
    .all(req.userId);
  res.json(rows);
});

app.get("/api/projects/:id", authMiddleware, requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .get(id, req.userId);
  if (!row) return res.status(404).json({ error: "見つかりません" });
  res.json({
    id: row.id,
    name: row.name,
    json: JSON.parse(row.json),
    updated_at: row.updated_at,
  });
});

app.post("/api/projects", authMiddleware, requireAuth, (req, res) => {
  const name = String(req.body?.name || "無題の作品").slice(0, 200);
  const json = req.body?.json;
  if (json == null) {
    return res.status(400).json({ error: "json が必要です" });
  }
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO projects (user_id, name, json, updated_at) VALUES (?, ?, ?, ?)`
    )
    .run(req.userId, name, JSON.stringify(json), now);
  res.json({ id: info.lastInsertRowid, name, updated_at: now });
});

app.put("/api/projects/:id", authMiddleware, requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
    .get(id, req.userId);
  if (!existing) return res.status(404).json({ error: "見つかりません" });
  const current = db.prepare("SELECT name FROM projects WHERE id = ?").get(id);
  const name =
    req.body?.name != null
      ? String(req.body.name).slice(0, 200)
      : current.name;
  const json = req.body?.json;
  if (json == null) {
    return res.status(400).json({ error: "json が必要です" });
  }
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE projects SET name = ?, json = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  ).run(name, JSON.stringify(json), now, id, req.userId);
  res.json({ id, name, updated_at: now });
});

app.delete("/api/projects/:id", authMiddleware, requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const r = db
    .prepare("DELETE FROM projects WHERE id = ? AND user_id = ?")
    .run(id, req.userId);
  if (r.changes === 0) return res.status(404).json({ error: "見つかりません" });
  res.json({ ok: true });
});

const dataDir = join(__dirname, "data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

app.listen(PORT, () => {
  console.log(`API http://127.0.0.1:${PORT}`);
});
