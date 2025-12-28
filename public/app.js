"use strict";

let sb;

// ---------- Helper ----------
const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle("hidden", !on);

// ---------- Supabase Init ----------
async function initSupabase() {
  if (!window.supabase) throw new Error("Supabase JS not loaded.");

  const res = await fetch("/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`/config failed: ${res.status}`);
  const cfg = await res.json();

  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "sb-auth",
    },
  });
}

// ---------- UI ----------
function renderLoggedOut() {
  show("authView", true);
  show("dashboardView", false);
  show("btnLogout", false);
  $("userInfo").textContent = "Nicht eingeloggt";
}

async function renderLoggedIn(session) {
  show("authView", false);
  show("dashboardView", true);
  show("btnLogout", true);
  $("userInfo").textContent = session.user.email;

  try {
    await loadProjects();
  } catch (e) {
    console.error("loadProjects failed:", e);
  }
}

async function refreshUI() {
  const { data, error } = await sb.auth.getSession();
  if (error) console.error(error);

  const session = data?.session;
  if (!session) return renderLoggedOut();
  return renderLoggedIn(session);
}

// ---------- AUTH ----------
async function login() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  if (!email || !password) return alert("E-Mail oder Passwort fehlt.");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  await refreshUI();
}

async function register() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  if (!email || !password) return alert("E-Mail oder Passwort fehlt.");

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

// ---------- PROJECTS ----------
async function createProject() {
  const title = $("npTitle").value.trim();
  if (!title) return alert("Titel fehlt.");

  const { data: sessData } = await sb.auth.getSession();
  const session = sessData?.session;
  if (!session) return alert("Nicht eingeloggt.");

  const meta = {
    editor: $("npEditor").value.trim(),
    cvd: $("npCvd").value.trim(),
    area: $("npArea").value.trim(),
    show: $("npShow").value.trim(),
    format: $("npFormat").value.trim(),
    target: $("npTarget").value.trim(),
    team: $("npTeam").value.trim(),
    short: $("npShort").value.trim(),
  };

  const { data, error } = await sb
    .from("projects")
    .insert([{ user_id: session.user.id, title, meta }])
    .select("id")
    .single();

  if (error) return alert(error.message);

  await loadProjects();

  // optional: direkt öffnen
  // window.location.href = `project.html?project_id=${encodeURIComponent(data.id)}`;
}

async function loadProjects() {
  const list = $("projectList");
  list.innerHTML = "";

  const { data: sessData } = await sb.auth.getSession();
  const session = sessData?.session;
  if (!session) {
    list.textContent = "Nicht eingeloggt.";
    return;
  }

  const { data, error } = await sb
    .from("projects")
    .select("id,title,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  (data || []).forEach((p) => {
    const row = document.createElement("div");
    row.className = "project-item";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.gap = "0.5rem";

    const title = document.createElement("div");
    title.textContent = p.title;
    title.style.flex = "1";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "small";
    btn.textContent = "Öffnen";
    btn.onclick = () => {
      window.location.href =
        `project.html?project_id=${encodeURIComponent(p.id)}`;
    };

    row.appendChild(title);
    row.appendChild(btn);
    list.appendChild(row);
  });
}

// ---------- START ----------
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
