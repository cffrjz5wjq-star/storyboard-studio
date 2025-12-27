"use strict";

let sb;

// Helper
const $ = (id) => document.getElementById(id);
const show = (id, on) => {
  const el = $(id);
  if (!el) {
    alert("UI-Element fehlt: #" + id);
    return;
  }
  el.classList.toggle("hidden", !on);
};

// -------------------- Supabase Init --------------------
async function initSupabase() {
  if (!window.supabase) throw new Error("Supabase JS nicht geladen");

  const res = await fetch("/config", { cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("/config Fehler: " + res.status + " " + t);
  }

  const cfg = await res.json();
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}

// -------------------- UI States --------------------
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
    console.error(e);
    alert("Login OK, aber loadProjects() abgestürzt:\n" + e.message);
  }
}

// -------------------- Session Handling --------------------
async function getSessionWithRetry(tries = 10, delay = 250) {
  for (let i = 0; i < tries; i++) {
    const { data } = await sb.auth.getSession();
    if (data?.session) return data.session;
    await new Promise((r) => setTimeout(r, delay));
  }
  return null;
}

async function refreshUI() {
  const session = await getSessionWithRetry(1, 0);
  if (!session) {
    renderLoggedOut();
    return;
  }
  await renderLoggedIn(session);
}

// -------------------- AUTH --------------------
async function login() {
  try {
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }

    const { data: u } = await sb.auth.getUser();
    alert("Login OK: " + (u?.user?.email || "KEIN USER"));

    if (data?.session) {
      await renderLoggedIn(data.session);
      return;
    }

    const session = await getSessionWithRetry(12, 250);
    if (session) {
      await renderLoggedIn(session);
      return;
    }

    alert(
      "Login erfolgreich, aber keine Session verfügbar.\n" +
      "Bitte Website-Daten für storyboard-studio.onrender.com löschen."
    );
  } catch (e) {
    console.error(e);
    alert("LOGIN CRASH:\n" + e.message);
  }
}

async function register() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) alert(error.message);
  else alert("Registriert. Bitte E-Mail bestätigen.");
}

async function logout() {
  await sb.auth.signOut();
  renderLoggedOut();
}

// -------------------- PROJECTS --------------------
async function createProject() {
  const title = $("npTitle").value.trim();
  if (!title) return alert("Titel fehlt");

  const payload = {
    title,
    data: {
      editor: $("npEditor").value,
      cvd: $("npCvd").value,
      area: $("npArea").value,
      show: $("npShow").value,
      format: $("npFormat").value,
      target: $("npTarget").value,
      team: $("npTeam").value,
      short: $("npShort").value,
    },
  };

  const { error } = await sb.from("projects").insert([payload]);
  if (error) alert(error.message);
  else await loadProjects();
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

// -------------------- START --------------------
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
    alert("INIT FEHLER:\n" + e.message);
  }
});
