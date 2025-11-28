// server.js
// Storyboard Studio – Express-Backend mit Auth (User + Admin)

const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Pfade für Daten ---
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Admin-Zugang (wie gewünscht)
const ADMIN_USER = "admin";
const ADMIN_PASS = "redcat"; // kleingeschrieben

// sicherstellen, dass Datenordner + Datei existieren
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), "utf8");
}

// Helper zum Lesen/Schreiben der User
function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const data = JSON.parse(raw);
    return data.users || [];
  } catch (e) {
    console.error("Konnte users.json nicht lesen:", e);
    return [];
  }
}

function saveUsers(users) {
  const payload = { users };
  fs.writeFileSync(USERS_FILE, JSON.stringify(payload, null, 2), "utf8");
}

// in-memory Sessions: sessionId -> { email, isAdmin }
const sessions = {};

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Statische Dateien aus ./public
app.use(express.static(path.join(__dirname, "public")));

// --- Auth-Helper ---
function getSession(req) {
  const sid = req.cookies && req.cookies.sb_session;
  if (!sid) return null;
  return sessions[sid] || null;
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Nicht eingeloggt" });
  }
  req.session = session;
  next();
}

// --- API: Registrierung ---
app.post("/api/register", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail und Passwort erforderlich." });
  }
  const normalized = String(email).trim().toLowerCase();
  if (!normalized.includes("@")) {
    return res.status(400).json({ error: "Bitte eine gültige E-Mail-Adresse verwenden." });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Passwort muss mindestens 4 Zeichen haben." });
  }

  const users = loadUsers();
  const existing = users.find(u => u.email === normalized);
  if (existing) {
    return res.status(409).json({ error: "E-Mail ist bereits registriert." });
  }

  const user = { id: uuidv4(), email: normalized, password };
  users.push(user);
  saveUsers(users);

  const sessionId = uuidv4();
  sessions[sessionId] = { email: normalized, isAdmin: false };

  res
    .cookie("sb_session", sessionId, {
      httpOnly: true,
      sameSite: "lax"
      // secure: true   // bei HTTPS aktivieren
    })
    .json({ email: normalized, isAdmin: false });
});

// --- API: Login ---
app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail/Nutzername und Passwort erforderlich." });
  }

  const normalized = String(email).trim().toLowerCase();

  // Admin-Spezialfall
  if (normalized === ADMIN_USER && password === ADMIN_PASS) {
    const sessionId = uuidv4();
    sessions[sessionId] = { email: ADMIN_USER, isAdmin: true };
    return res
      .cookie("sb_session", sessionId, {
        httpOnly: true,
        sameSite: "lax"
      })
      .json({ email: ADMIN_USER, isAdmin: true });
  }

  // normaler User
  const users = loadUsers();
  const user = users.find(u => u.email === normalized);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "E-Mail oder Passwort falsch." });
  }

  const sessionId = uuidv4();
  sessions[sessionId] = { email: normalized, isAdmin: false };

  res
    .cookie("sb_session", sessionId, {
      httpOnly: true,
      sameSite: "lax"
    })
    .json({ email: normalized, isAdmin: false });
});

// --- API: Logout ---
app.post("/api/logout", (req, res) => {
  const sid = req.cookies && req.cookies.sb_session;
  if (sid && sessions[sid]) {
    delete sessions[sid];
  }
  res.clearCookie("sb_session");
  res.json({ ok: true });
});

// --- API: aktueller User ---
app.get("/api/me", (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Keine gültige Session." });
  res.json(session);
});

// Beispiel für spätere Admin-API
app.get("/api/admin/users", (req, res) => {
  const session = getSession(req);
  if (!session || !session.isAdmin) {
    return res.status(403).json({ error: "Nur Admin." });
  }
  const users = loadUsers().map(u => ({ id: u.id, email: u.email }));
  res.json({ users });
});

// Fallback: index.html für alle unbekannten Routen (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Storyboard Studio läuft auf http://localhost:${PORT}`);
});