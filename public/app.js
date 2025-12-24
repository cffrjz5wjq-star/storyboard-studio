"use strict";

let sb; // Supabase client (absichtlich NICHT "supabase" nennen)

// Helper
const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle("hidden", !on);

async function initSupabase() {
  // Supabase Library muss da sein
  if (!window.supabase) throw new Error("Supabase JS not loaded (window.supabase missing).");

  const res = await fetch("/config", { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`/config failed: ${res.status} ${t}`);
  }
  const cfg = await res.json();

  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}

async function refreshUI() {
  const { data, error } = await sb.auth.getSession();
  if (error) console.error(error);

  const session = data?.session;

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
  $("userInfo").textContent = session.user.email;

  loadProjects();
}

// Auth actions
async function login() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
}

async function register() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      // wichtig für E-Mail-Bestätigung (Link kommt zurück zu deiner Render-URL)
      emailRedirectTo: window.location.origin,
    },
  });

  if (error) alert(error.message);
  else alert("Registriert. Bitte E-Mail bestätigen (Spam prüfen).");
}

async function logout() {
  await sb.auth.signOut();
}

// Projects
async function createProject() {
  const title = $("npTitle").value.trim();
  if (!title) return alert("Titel fehlt");

  const data = {
    editor: $("npEditor").value,
    cvd: $("npCvd").value,
    area: $("npArea").value,
    show: $("npShow").value,
    format: $("npFormat").value,
    target: $("npTarget").value,
    team: $("npTeam").value,
    short: $("npShort").value,
  };

  const { error } = await sb.from("projects").insert([{ title, data }]);
  if (error) alert(error.message);
  else loadProjects();
}

async function loadProjects() {
  const list = $("projectList");
  list.innerHTML = "";

  const { data, error } = await sb
    .from("projects")
    .select("id,title")
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

    $("btnLogin").onclick = login;
    $("btnRegister").onclick = register;
    $("btnLogout").onclick = logout;
    $("btnCreateProject").onclick = createProject;

    sb.auth.onAuthStateChange(() => refreshUI());
    await refreshUI();
  } catch (e) {
    console.error(e);
    alert(String(e.message || e));
  }
});
