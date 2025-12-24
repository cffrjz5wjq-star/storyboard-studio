"use strict";

let supabase;

// Helper
const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle("hidden", !on);

// Init
async function initSupabase() {
  const res = await fetch("/config");
  const cfg = await res.json();
  supabase = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );
}

// Auth UI
async function refreshUI() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

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

// Auth Actions
async function login() {
  const email = $("loginEmail").value;
  const password = $("loginPassword").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
}

async function register() {
  const email = $("loginEmail").value;
  const password = $("loginPassword").value;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert("Registriert. Falls aktiviert: Mail bestätigen.");
}

async function logout() {
  await supabase.auth.signOut();
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
    short: $("npShort").value
  };

  const { error } = await supabase.from("projects").insert([{ title, data }]);
  if (error) alert(error.message);
  else loadProjects();
}

async function loadProjects() {
  const list = $("projectList");
  list.innerHTML = "";

  const { data, error } = await supabase
    .from("projects")
    .select("id,title")
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "project-item";
    div.textContent = p.title;
    list.appendChild(div);
  });
}

// Start
document.addEventListener("DOMContentLoaded", async () => {
  await initSupabase();

  $("btnLogin").onclick = login;
  $("btnRegister").onclick = register;
  $("btnLogout").onclick = logout;
  $("btnCreateProject").onclick = createProject;

  supabase.auth.onAuthStateChange(refreshUI);
  refreshUI();
});
