"use strict";

let sbClient = null;

// Helper
const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle("hidden", !on);

async function initSupabase() {
  const res = await fetch("/config", { cache: "no-store" });
  if (!res.ok) throw new Error("Konnte /config nicht laden: " + res.status);

  const cfg = await res.json();
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL oder SUPABASE_ANON_KEY fehlt in /config");
  }

  // Wichtig: NICHT "supabase" als Variable benutzen
  sbClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}

async function refreshUI() {
  if (!sbClient) return;

  const { data, error } = await sbClient.auth.getSession();
  if (error) console.warn("getSession error:", error);

  const session = data?.session ?? null;

  if (!session) {
    show("authView", true);
    show("dashboardView", false);
    show("btnLogout", false);
    $("userInfo").textContent = "Nicht eingeloggt";
    return;
  }

  show("authView", false);
  show("dashboardView", true);
  show("btnLogout", true);
  $("userInfo").textContent = session.user.email || "Eingeloggt";

  loadProjects();
}

// Auth Actions
async function login() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  // Wenn Email-Confirmation aktiv ist, kommt oft "Email not confirmed"
  if (!data?.session) {
    alert("Login ok, aber noch keine Session. Falls E-Mail-Bestätigung aktiv ist: Mail bestätigen.");
  }

  refreshUI();
}

async function register() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const redirectTo = window.location.origin; // z.B. https://storyboard-studio.onrender.com

  const { data, error } = await sbClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo }
  });

  if (error) return alert(error.message);

  // Bei Confirm Email: User wird angelegt, aber keine Session -> Mail muss bestätigt werden
  alert("Registriert. Bitte E-Mail öffnen und bestätigen (ggf. Spam prüfen).");
  console.log("signUp data:", data);
}

async function logout() {
  await sbClient.auth.signOut();
  refreshUI();
}

// Projects
async function createProject() {
  const title = $("npTitle").value.trim();
  if (!title) return alert("Titel fehlt");

  const payload = {
    editor: $("npEditor").value,
    cvd: $("npCvd").value,
    area: $("npArea").value,
    show: $("npShow").value,
    format: $("npFormat").value,
    target: $("npTarget").value,
    team: $("npTeam").value,
    short: $("npShort").value
  };

  const { error } = await sbClient.from("projects").insert([{ title, data: payload }]);
  if (error) return alert(error.message);

  loadProjects();
}

async function loadProjects() {
  const list = $("projectList");
  list.innerHTML = "";

  const { data, error } = await sbClient
    .from("projects")
    .select("id,title,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  data.forEach((p) => {
    const div = document.createElement("div");
    div.className = "project-item";
    div.textContent = p.title;
    list.appendChild(div);
  });
}

// Start
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initSupabase();
  } catch (e) {
    console.error(e);
    alert("Supabase Init Fehler: " + e.message);
    return;
  }

  $("btnLogin").onclick = login;
  $("btnRegister").onclick = register;
  $("btnLogout").onclick = logout;

  const btnCreate = $("btnCreateProject");
  if (btnCreate) btnCreate.onclick = createProject;

  sbClient.auth.onAuthStateChange(() => refreshUI());
  refreshUI();
});
