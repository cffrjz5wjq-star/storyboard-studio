// app.js
// Storyboard Studio – Login, Projektverwaltung, Navigation zur Projektseite

// ----------------------------------------------------------
// Hilfsfunktionen
// ----------------------------------------------------------

function safeKey(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Fehler beim Lesen von", key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ----------------------------------------------------------
// Session & Benutzerverwaltung
// ----------------------------------------------------------

function getCurrentUser() {
  return loadJSON("sb_session", null);
}

function getCurrentUserEmail() {
  const session = getCurrentUser();
  return session ? session.email : null;
}

function login(email, password) {
  email = email.trim().toLowerCase();

  // Admin immer erlauben
  if (email === "admin@stefanweichelt.de") {
    if (!password) return { error: "Passwort erforderlich" };
    saveJSON("sb_session", { email, role: "admin" });
    return { ok: true };
  }

  // Normale Nutzer
  const users = loadJSON("sb_users", []);
  let user = users.find(u => u.email === email);

  if (!user) {
    return { error: "Benutzer nicht gefunden" };
  }
  if (user.password !== password) {
    return { error: "Falsches Passwort" };
  }

  saveJSON("sb_session", { email, role: "user" });
  return { ok: true };
}

function registerUser(email, password) {
  email = email.trim().toLowerCase();

  const users = loadJSON("sb_users", []);
  if (users.find(u => u.email === email)) {
    return { error: "Benutzer existiert bereits" };
  }

  users.push({ email, password });
  saveJSON("sb_users", users);

  saveJSON("sb_session", { email, role: "user" });
  return { ok: true };
}

function logout() {
  localStorage.removeItem("sb_session");
  window.location.reload();
}

// ----------------------------------------------------------
// Projekte speichern / laden
// ----------------------------------------------------------

function getProjectsKey() {
  const email = getCurrentUserEmail();
  if (!email) return null;
  return "sb_projects_" + safeKey(email);
}

function loadProjects() {
  const key = getProjectsKey();
  if (!key) return [];
  return loadJSON(key, []);
}

function saveProjects(projects) {
  const key = getProjectsKey();
  if (!key) return;
  saveJSON(key, projects);
}

function createProjectId(title) {
  return safeKey(title) + "_" + Date.now().toString(36);
}

function addProject(p) {
  const projects = loadProjects();
  projects.push(p);
  saveProjects(projects);
}

function updateProject(p) {
  const projects = loadProjects();
  const index = projects.findIndex(x => x.id === p.id);
  if (index >= 0) {
    projects[index] = p;
    saveProjects(projects);
  }
}

// ----------------------------------------------------------
// Navigation in den Editor
// ----------------------------------------------------------

function openProjectById(projectId) {
  const projects = loadProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    alert("Projekt nicht gefunden.");
    return;
  }

  saveJSON("sb_active_project", project);
  window.location.href = "project.html";
}

// ----------------------------------------------------------
// UI-Elemente füllen
// ----------------------------------------------------------

function updateProjectList() {
  const container = document.getElementById("projectList");
  if (!container) return;

  const projects = loadProjects();
  container.innerHTML = "";

  if (!projects.length) {
    container.innerHTML = `<div class="hint">Noch keine Projekte vorhanden.</div>`;
    return;
  }

  projects.forEach(p => {
    const el = document.createElement("div");
    el.className = "project-item";

    el.innerHTML = `
      <div class="project-item-main">
        <div class="project-item-title">${p.title}</div>
        <div class="project-item-meta">${p.show || ""} · ${p.format || ""}</div>
      </div>
      <div class="project-item-actions">
        <button class="small" data-open="${p.id}">Öffnen</button>
      </div>
    `;

    container.appendChild(el);
  });

  container.querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      openProjectById(id);
    });
  });
}

// ----------------------------------------------------------
// Login-Ansicht ein-/ausblenden
// ----------------------------------------------------------

function showAuthView() {
  document.getElementById("authView").classList.remove("hidden");
  document.getElementById("dashboardView").classList.add("hidden");
  document.getElementById("userInfo").textContent = "Nicht eingeloggt";
  document.getElementById("btnLogout").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("authView").classList.add("hidden");
  document.getElementById("dashboardView").classList.remove("hidden");

  const session = getCurrentUser();
  document.getElementById("userInfo").textContent = session.email;
  document.getElementById("btnLogout").classList.remove("hidden");

  updateProjectList();
}

// ----------------------------------------------------------
// Neues Projekt anlegen
// ----------------------------------------------------------

function createProjectFromForm() {
  const title = document.getElementById("npTitle").value.trim();
  if (!title) {
    alert("Titel fehlt");
    return;
  }

  const p = {
    id: createProjectId(title),
    title,
    editor: document.getElementById("npEditor").value.trim(),
    cvd: document.getElementById("npCvd").value.trim(),
    area: document.getElementById("npArea").value.trim(),
    show: document.getElementById("npShow").value.trim(),
    format: document.getElementById("npFormat").value.trim(),
    target: document.getElementById("npTarget").value.trim(),
    team: document.getElementById("npTeam").value.trim(),
    shortDesc: document.getElementById("npShort").value.trim(),
    createdAt: new Date().toISOString(),
    takes: []
  };

  addProject(p);
  updateProjectList();

  // Formular leeren
  document.getElementById("npTitle").value = "";
  document.getElementById("npEditor").value = "";
  document.getElementById("npCvd").value = "";
  document.getElementById("npArea").value = "";
  document.getElementById("npShow").value = "";
  document.getElementById("npFormat").value = "";
  document.getElementById("npTarget").value = "";
  document.getElementById("npTeam").value = "";
  document.getElementById("npShort").value = "";

  alert("Projekt gespeichert.");
}

// ----------------------------------------------------------
// Event-Setup
// ----------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  // Login
  document.getElementById("btnLogin").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value;
    const pw = document.getElementById("loginPassword").value;
    const r = login(email, pw);

    if (r.error) alert(r.error);
    else showDashboard();
  });

  // Registrierung
  document.getElementById("btnRegister").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value;
    const pw = document.getElementById("loginPassword").value;
    const r = registerUser(email, pw);

    if (r.error) alert(r.error);
    else showDashboard();
  });

  // Logout
  document.getElementById("btnLogout").addEventListener("click", logout);

  // Neues Projekt beginnen
  document.getElementById("btnNewProjectTop").addEventListener("click", () => {
    document.getElementById("newProjectForm").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("btnNewProjectTile").addEventListener("click", () => {
    document.getElementById("newProjectForm").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("btnCreateProject").addEventListener("click", createProjectFromForm);
  document.getElementById("btnResetProjectForm").addEventListener("click", () => {
    document.getElementById("newProjectForm").querySelectorAll("input, textarea").forEach(el => el.value = "");
  });

  // Session prüfen
  const session = getCurrentUser();
  if (session) {
    showDashboard();
  } else {
    showAuthView();
  }
});
app.get("/test-supabase", async (req, res) => {
  try {
    const { createClient } = require("@supabase/supabase-js");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // einfache Anfrage: bekommt Metadaten zurück
    const { data, error } = await supabase.from("pg_tables").select("*").limit(1);

    res.json({ success: !error, data, error });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});
