"use strict";

let sb; // Supabase client

const $ = (id) => document.getElementById(id);

function show(id, on) {
  const el = $(id);
  if (!el) {
    console.warn("show(): Element fehlt:", id);
    return;
  }
  el.classList.toggle("hidden", !on);
}

async function initSupabase() {
  if (!window.supabase) throw new Error("Supabase JS not loaded (window.supabase missing).");

  const res = await fetch("/config", { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`/config failed: ${res.status} ${t}`);
  }
  const cfg = await res.json();

  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}

function renderLoggedOut() {
  show("authView", true);
  show("dashboardView", false);
  show("btnLogout", false);
  const ui = $("userInfo");
  if (ui) ui.textContent = "Nicht eingeloggt";
}

async function renderLoggedIn(session) {
  show("authView", false);
  show("dashboardView", true);
  show("btnLogout", true);
  const ui = $("userInfo");
  if (ui) ui.textContent = session.user?.email || "Eingeloggt";

  await loadProjects();
}

async function getSessionWithRetry(tries = 15, delayMs = 250) {
  for (let i = 0; i < tries; i++) {
    const { data, error } = await sb.auth.getSession();
    if (error) console.error("getSession error:", error);
    if (data?.session) return data.session;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function refreshUI() {
  const session = await getSessionWithRetry(15, 250);
  if (!session) {
    renderLoggedOut();
    return;
  }
  await renderLoggedIn(session);
}

// ---------- Auth ----------
async function login() {
  const email = ($("loginEmail")?.value || "").trim();
  const password = $("loginPassword")?.value || "";

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    alert(error.message);
    return;
  }

  // Wenn Supabase sofort Session liefert: direkt umschalten
  if (data?.session) {
    await renderLoggedIn(data.session);
    return;
  }

  // Sonst UI über Retry aktualisieren
  await refreshUI();
}

async function register() {
  const email = ($("loginEmail")?.value || "").trim();
  const password = $("loginPassword")?.value || "";

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) alert(error.message);
  else alert("Registriert. Bitte E-Mail bestätigen (Spam prüfen).");
}

async function logout() {
  await sb.auth.signOut();
  renderLoggedOut();
}

// ---------- Projects ----------
async function createProject() {
  const title = ($("npTitle")?.value || "").trim();
  if (!title) return alert("Titel fehlt");

  // Achtung: Das funktioniert nur, wenn es in Supabase eine Spalte "data" gibt!
  const payload = {
    title,
    data: {
      editor: $("npEditor")?.value || "",
      cvd: $("npCvd")?.value || "",
      area: $("npArea")?.value || "",
      show: $("npShow")?.value || "",
      format: $("npFormat")?.value || "",
      target: $("npTarget")?.value || "",
      team: $("npTeam")?.value || "",
      short: $("npShort")?.value || "",
    },
  };

  const { error } = await sb.from("projects").insert([payload]);
  if (error) alert(error.message);
  else await loadProjects();
}

async function loadProjects() {
  const list = $("projectList");
  if (!list) return;
  list.innerHTML = "";

  const { data, error } = await sb
    .from("projects")
    .select("id,title")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  (data || []).forEach((p) => {
    const div = document.createElement("div");
    div.className = "project-item";
    div.textContent = p.title;
    list.appendChild(div);
  });
}

// ---------- Start ----------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initSupabase();

    const btnLogin = $("btnLogin");
    if (btnLogin) btnLogin.onclick = login;

    const btnRegister = $("btnRegister");
    if (btnRegister) btnRegister.onclick = register;

    const btnLogout = $("btnLogout");
    if (btnLogout) btnLogout.onclick = logout;

    const btnCreate = $("btnCreateProject");
    if (btnCreate) btnCreate.onclick = createProject;

    sb.auth.onAuthStateChange(() => refreshUI());
    await refreshUI();
  } catch (e) {
    console.error(e);
    alert(String(e.message || e));
  }
});
