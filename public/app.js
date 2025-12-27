"use strict";

let sb;

const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle("hidden", !on);

const log = (...args) => console.log("[SB]", ...args);
const warn = (...args) => console.warn("[SB]", ...args);
const err = (...args) => console.error("[SB]", ...args);

async function initSupabase() {
  log("initSupabase: start");

  if (!window.supabase) throw new Error("Supabase JS not loaded (window.supabase missing).");

  // Storage quick check
  try {
    localStorage.setItem("__sb_test__", "1");
    localStorage.removeItem("__sb_test__");
    log("localStorage: OK");
  } catch (e) {
    warn("localStorage: BLOCKED", e);
  }

  const res = await fetch("/config", { cache: "no-store" });
  log("/config status:", res.status);

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`/config failed: ${res.status} ${t}`);
  }

  const cfg = await res.json();
  log("cfg:", {
    url: cfg.SUPABASE_URL,
    anonKeyLen: (cfg.SUPABASE_ANON_KEY || "").length,
  });

  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // explizit localStorage erzwingen
      storage: window.localStorage,
    },
  });

  log("initSupabase: client created");
}

function renderLoggedOut() {
  log("renderLoggedOut()");
  show("authView", true);
  show("dashboardView", false);
  show("btnLogout", false);
  $("userInfo").textContent = "Nicht eingeloggt";
}

async function renderLoggedIn(session) {
  log("renderLoggedIn()", { email: session?.user?.email });

  show("authView", false);
  show("dashboardView", true);
  show("btnLogout", true);
  $("userInfo").textContent = session.user.email;

  // Ganz wichtig: Fehler hier sichtbar machen
  try {
    await loadProjects();
  } catch (e) {
    err("loadProjects crashed:", e);
    alert("Login ok, aber loadProjects crashed: " + (e?.message || e));
  }
}

async function getSessionOnce() {
  const { data, error } = await sb.auth.getSession();
  if (error) err("getSession error:", error);
  log("getSession -> hasSession:", !!data?.session);
  return data?.session || null;
}

async function getSessionWithRetry(tries = 12, delayMs = 250) {
  for (let i = 0; i < tries; i++) {
    const s = await getSessionOnce();
    if (s) return s;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function refreshUI() {
  log("refreshUI()");
  const session = await getSessionOnce();
  if (!session) return renderLoggedOut();
  return renderLoggedIn(session);
}

// Auth actions
async function login() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  log("login(): start", { email });

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  log("signInWithPassword(): returned", {
    hasUser: !!data?.user,
    hasSession: !!data?.session,
    error: error ? error.message : null,
  });

  if (error) {
    alert(error.message);
    return;
  }

  // a) Sofort-Session
  if (data?.session) {
    log("login(): got immediate session");
    await renderLoggedIn(data.session);
    return;
  }

  // b) Nachziehen (wenn Supabase Session minimal verzögert persistiert)
  log("login(): no session returned, retry getSession...");
  const session = await getSessionWithRetry(20, 200);

  log("login(): session after retry:", !!session);

  if (session) {
    await renderLoggedIn(session);
    return;
  }

  alert(
    "Login war erfolgreich, aber es konnte keine Session gespeichert/geladen werden.\n" +
      "Das ist fast immer Storage/Cookie/Blocker.\n\n" +
      "Test: Öffne DevTools → Application → Local Storage → storyboard-studio.onrender.com\n" +
      "und prüfe, ob Einträge mit 'sb-' / 'supabase' erscheinen."
  );
}

async function register() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  log("register(): start", { email });

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });

  log("signUp(): returned", {
    hasUser: !!data?.user,
    hasSession: !!data?.session,
    error: error ? error.message : null,
  });

  if (error) alert(error.message);
  else alert("Registriert. Bitte E-Mail bestätigen (Spam prüfen).");
}

async function logout() {
  log("logout(): start");
  await sb.auth.signOut();
  renderLoggedOut();
}

// Projects
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

  log("createProject(): inserting", payload);

  const { data, error } = await sb.from("projects").insert([payload]).select();

  log("createProject(): result", { ok: !error, error: error?.message, data });

  if (error) alert(error.message);
  else await loadProjects();
}

async function loadProjects() {
  log("loadProjects(): start");

  const list = $("projectList");
  list.innerHTML = "";

  const { data, error } = await sb
    .from("projects")
    .select("id,title,created_at")
    .order("created_at", { ascending: false });

  log("loadProjects(): result", { count: data?.length || 0, error: error?.message || null });

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

// Start
document.addEventListener("DOMContentLoaded", async () => {
  try {
    log("DOM ready");

    await initSupabase();

    $("btnLogin").onclick = login;
    $("btnRegister").onclick = register;
    $("btnLogout").onclick = logout;
    $("btnCreateProject").onclick = createProject;

    sb.auth.onAuthStateChange((event, session) => {
      log("onAuthStateChange:", event, { hasSession: !!session });
      refreshUI();
    });

    await refreshUI();
  } catch (e) {
    err("BOOT ERROR:", e);
    alert(String(e.message || e));
  }
});
