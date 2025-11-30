// server.js
// Storyboard Studio – Express-Backend mit Auth (User + Admin) und einfachen Projekten

const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------
// Pfade für Dateien
// ----------------------
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

// Admin-Zugang
const ADMIN_LOGIN = "admin";
const ADMIN_EMAIL = "admin@stefanweichelt.de";
const ADMIN_PASS = "redcat"; // kleingeschrieben

// ----------------------
// Datenordner vorbereiten
// ----------------------
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2), "utf8");
}
if (!fs.existsSync(PROJECTS_FILE)) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: [] }, null, 2), "utf8");
}

// ----------------------
// Helper: Users
// ----------------------
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

// ----------------------
// Helper: Projekte
// ----------------------
function loadProjects() {
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, "utf8");
    const data = JSON.parse(raw);
    return data.projects || [];
  } catch (e) {
    console.error("Konnte projects.json nicht lesen:", e);
    return [];
  }
}

function saveProjects(projects) {
  const payload = { projects };
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(payload, null, 2), "utf8");
}

// ----------------------
// Sessions (in-memory)
// ----------------------
// Achtung: Auf Render werden Sessions bei Neustart gelöscht – für jetzt ok.
const sessions = {}; // sessionId -> { email, isAdmin }

// ----------------------
// Middleware
// ----------------------
app.use(express.json());
app.use(cookieParser());

// Statische Dateien aus ./public
app.use(express.static(path.join(__dirname, "public")));

// ----------------------
// Auth-Helper
// ----------------------
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

// ----------------------
// API: Registrierung
// ----------------------
app.post("/api/register", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail und Passwort erforderlich." });
  }

  const normalized = String(email).trim().toLowerCase();

  // Admin-Namen reservieren
  if (normalized === ADMIN_LOGIN || normalized === ADMIN_EMAIL) {
    return res.status(400).json({ error: "Diese E-Mail ist reserviert." });
  }
  if (!normalized.includes("@")) {
    return res.status(400).json({ error: "Bitte eine gültige E-Mail-Adresse verwenden." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Passwort muss mindestens 6 Zeichen haben." });
  }

  const users = loadUsers();
  const existing = users.find(u => u.email === normalized);
  if (existing) {
    return res.status(409).json({ error: "E-Mail ist bereits registriert." });
  }

  const user = {
    id: uuidv4(),
    email: normalized,
    name: name || normalized,
    password
  };
  users.push(user);
  saveUsers(users);

  // Session direkt anlegen -> nach Registrierung eingeloggt
  const sessionId = uuidv4();
  sessions[sessionId] = { email: user.email, isAdmin: false, name: user.name };

  res
    .cookie("sb_session", sessionId, {
      httpOnly: true,
      sameSite: "lax"
      // secure: true // bei HTTPS auf eigener Domain aktivieren
    })
    .json({ email: user.email, isAdmin: false, name: user.name });
});

// ----------------------
// API: Login
// ----------------------
app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "E-Mail/Nutzername und Passwort erforderlich." });
  }

  const normalized = String(email).trim().toLowerCase();

  // Admin-Spezialfall: akzeptiere "admin" oder "admin@stefanweichelt.de"
  if (
    (normalized === ADMIN_LOGIN || normalized === ADMIN_EMAIL) &&
    password === ADMIN_PASS
  ) {
    const sessionId = uuidv4();
    sessions[sessionId] = {
      email: ADMIN_EMAIL,
      isAdmin: true,
      name: "Admin"
    };
    return res
      .cookie("sb_session", sessionId, {
        httpOnly: true,
        sameSite: "lax"
      })
      .json({ email: ADMIN_EMAIL, isAdmin: true, name: "Admin" });
  }

  // normaler User
  const users = loadUsers();
  const user = users.find(u => u.email === normalized);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "E-Mail oder Passwort falsch." });
  }

  const sessionId = uuidv4();
  sessions[sessionId] = {
    email: user.email,
    isAdmin: false,
    name: user.name || user.email
  };

  res
    .cookie("sb_session", sessionId, {
      httpOnly: true,
      sameSite: "lax"
    })
    .json({ email: user.email, isAdmin: false, name: user.name || user.email });
});

// ----------------------
// API: Logout
// ----------------------
app.post("/api/logout", (req, res) => {
  const sid = req.cookies && req.cookies.sb_session;
  if (sid && sessions[sid]) {
    delete sessions[sid];
  }
  res.clearCookie("sb_session");
  res.json({ ok: true });
});

// ----------------------
// API: aktueller User
// ----------------------
app.get("/api/me", (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Keine gültige Session." });
  res.json(session);
});

// ----------------------
// API: Projekte (einfach)
// ----------------------
app.get("/api/projects", requireAuth, (req, res) => {
  const all = loadProjects();
  const userEmail = req.session.email;
  const isAdmin = req.session.isAdmin;

  const visible = all.filter(p => {
    if (isAdmin) return true;
    if (p.ownerEmail === userEmail) return true;
    if (Array.isArray(p.collaborators) && p.collaborators.includes(userEmail)) {
      return true;
    }
    return false;
  });

  res.json({ projects: visible });
});

app.post("/api/projects", requireAuth, (req, res) => {
  const { title, editor, cvd, area, show, format, type, lengthMinutes, meta } =
    req.body || {};

  if (!title) {
    return res.status(400).json({ error: "Titel ist erforderlich." });
  }

  const all = loadProjects();
  const now = new Date().toISOString();
  const project = {
    id: uuidv4(),
    ownerEmail: req.session.email,
    title,
    editor: editor || "",
    cvd: cvd || "",
    area: area || "",
    show: show || "",
    format: format || "",
    type: type || "Einzelbeitrag",
    lengthMinutes: lengthMinutes || null,
    meta: meta || {}, // z.B. zielgruppe, inhalt, besonderheiten
    collaborators: [],
    createdAt: now,
    updatedAt: now
  };

  all.push(project);
  saveProjects(all);

  res.status(201).json(project);
});

app.get("/api/projects/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  const all = loadProjects();
  const project = all.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: "Projekt nicht gefunden." });

  const userEmail = req.session.email;
  const isAdmin = req.session.isAdmin;

  if (
    !isAdmin &&
    project.ownerEmail !== userEmail &&
    !(Array.isArray(project.collaborators) && project.collaborators.includes(userEmail))
  ) {
    return res.status(403).json({ error: "Kein Zugriff auf dieses Projekt." });
  }

  res.json(project);
});

// (später: PUT /api/projects/:id für Updates, Takes etc.)

// ----------------------
// Admin-API-Beispiel
// ----------------------
app.get("/api/admin/users", (req, res) => {
  const session = getSession(req);
  if (!session || !session.isAdmin) {
    return res.status(403).json({ error: "Nur Admin." });
  }
  const users = loadUsers().map(u => ({ id: u.id, email: u.email, name: u.name }));
  res.json({ users });
});

// ----------------------
// SPA-Fallback
// ----------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Storyboard Studio läuft auf http://localhost:${PORT}`);
});
