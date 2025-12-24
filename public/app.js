"use strict";

let sb = null;

// Helper
const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id)?.classList.toggle("hidden", !on);

function errMsg(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  return e.message || JSON.stringify(e);
}

async function initSupabase() {
  // holt SUPABASE_URL / SUPABASE_ANON_KEY vom Server
  const res = await fetch("/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`/config failed: ${res.status}`);

  const cfg = await res.json();
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    throw new Error("Config missing SUPABASE_URL / SUPABASE_ANON_KEY");
  }

  // WICHTIG: Supabase Client NUR EINMAL erstellen
  if (!window.supabase?.createClient) {
    throw new Error("Supabase SDK not loaded (supabase-js@2 fehlt im index.html)");
  }

  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}

// UI
async function refreshUI() {
  const { data, error } = await sb.auth.getSession();
  if (error) console.error("getSession error:", error);

  const session = data?.session;

  if (!session) {
    show("authView", true);
    show("dashboardView", false);
    show("btnLogout", false);
    if ($("userInfo")) $("userInfo").textContent = "Nicht eingeloggt";
    return;
  }

  show("authView", false);
  show("dashboardView", true);
  show("btnLogout", true);
  if ($("userInfo")) $("userInfo").textContent = session.user.email || "Eingeloggt";

  await loadProjects();
}

// Auth
async function login() {
  const email = ($("loginEmail")?.value || "").trim();
  const password = $("loginPassword")?.value || "";

  if (!email || !password) return alert("E-Mail und Passwort fehlen.");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return alert("Login: " + errMsg(error));
}

async function register() {
  const email = ($("loginEmail")?.value || "").trim();
  const password = $("loginPassword")?.value || "";

  if (!email || !password) return alert("E-Mail und Passwort fehlen.");

  // Redirect-Link in der Bestätigungs-Mail (muss in Supabase als Redirect URL erlaubt sein!)
  const emailRedirectTo = `${window.location.origin}/`;

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo }
  });

  if (error) return alert("Registrierung: " + errMsg(error));

  // Bei aktivierter E-Mail-Confirmation ist session i.d.R. null bis bestätigt.
  const user = data?.user;
  if (user) {
    alert("Registriert. Bitte E-Mail bestätigen, dann einloggen.");
  } else {
    alert("Registriert. Bitte E-Mail bestätigen, dann einloggen.");
  }
}

async function logout() {
  const { error } = await sb.auth.signOut();
  if (error) alert("Logout: " + errMsg(error));
}

// Projects
async function createProject() {
  const title = ($("npTitle")?.value || "").trim();
  if (!title) return alert("Titel fehlt.");

  const { data: sessData } = await sb.auth.getSession();
  const userId = sessData?.session?.user?.id;

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
      short: $("npShort")?.value || ""
    }
  };

  // Wenn du RLS aktiv hast, brauchst du typischerweise user_id in der Tabelle:
  // Falls deine Tabelle kein user_id hat, diese Zeile rausnehmen.
  if (userId) payload.user_id = userId;

  const { error } = await sb.from("projects").insert([payload]);
  if (error) return alert("Projekt speichern: " + errMsg(error));

  await loadProjects();
}

async function loadProjects() {
  const list = $("projectList");
  if (!list) return;
  list.innerHTML = "";

  const { data: sessData } = await sb.auth.getSession();
  const userId = sessData?.session?.user?.id;

  // Wenn du RLS + user_id nutzt, filtern:
  let q = sb.from("projects").select("id,title").order("created_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);

  const { data, error } = await q;
  if (error) {
    list.textContent = "Load: " + errMsg(error);
    return;
  }

  (data || []).forEach((p) => {
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

    // Buttons
    if ($("btnLogin")) $("btnLogin").onclick = login;
    if ($("btnRegister")) $("btnRegister").onclick = register;
    if ($("btnLogout")) $("btnLogout").onclick = logout;
    if ($("btnCreateProject")) $("btnCreateProject").onclick = createProject;

    // Auth listener
    sb.auth.onAuthStateChange(() => {
      refreshUI();
    });

    await refreshUI();
  } catch (e) {
    console.error(e);
    alert("Init Fehler: " + errMsg(e));
  }
});
