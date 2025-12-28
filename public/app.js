"use strict";

/**
 * Storyboard Studio – app.js (Dashboard/Login/Projects)
 * Robust gegen Session-Flackern, Storage-Probleme und Auth-Loop.
 */

let sb = null;

const $ = (id) => document.getElementById(id);
const show = (id, on) => {
  const el = $(id);
  if (el) el.classList.toggle("hidden", !on);
};

const UI = {
  authView: "authView",
  dashboardView: "dashboardView",
  btnLogout: "btnLogout",
  userInfo: "userInfo",
  projectList: "projectList",
  btnLogin: "btnLogin",
  btnRegister: "btnRegister",
  btnCreateProject: "btnCreateProject",
};

// -----------------------------
// Storage-Fallback (localStorage -> memory)
// -----------------------------
function createSafeStorage(prefix = "sb-") {
  const mem = new Map();

  function k(key) {
    return prefix + key;
  }

  function localStorageWorks() {
    try {
      const testKey = k("__test__");
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  const hasLS = typeof window !== "undefined" && window.localStorage && localStorageWorks();

  return {
    hasLS,
    getItem: (key) => {
      const kk = k(key);
      try {
        if (hasLS) return window.localStorage.getItem(kk);
      } catch {
        // ignore
      }
      return mem.has(kk) ? mem.get(kk) : null;
    },
    setItem: (key, value) => {
      const kk = k(key);
      try {
        if (hasLS) {
          window.localStorage.setItem(kk, value);
          return;
        }
      } catch {
        // ignore
      }
      mem.set(kk, value);
    },
    removeItem: (key) => {
      const kk = k(key);
      try {
        if (hasLS) window.localStorage.removeItem(kk);
      } catch {
        // ignore
      }
      mem.delete(kk);
    },
  };
}

const safeStorage = createSafeStorage("sb-auth-");

// -----------------------------
// Supabase init
// -----------------------------
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
      // Wichtig: eigenes Storage mit Memory-Fallback
      storage: safeStorage,
      flowType: "pkce",
    },
    global: {
      headers: { "x-client-info": "storyboard-studio" },
    },
  });

  // Wenn localStorage nicht geht, sagen wir das sofort (statt komisch zu tun)
  if (!safeStorage.hasLS) {
    console.warn("[auth] localStorage unavailable -> using in-memory session storage");
  }
}

// -----------------------------
// UI render
// -----------------------------
function renderLoggedOut(msg) {
  show(UI.authView, true);
  show(UI.dashboardView, false);
  show(UI.btnLogout, false);
  const u = $(UI.userInfo);
  if (u) u.textContent = "Nicht eingeloggt";

  if (msg) console.warn("[auth]", msg);
}

async function renderLoggedIn(session) {
  show(UI.authView, false);
  show(UI.dashboardView, true);
  show(UI.btnLogout, true);

  const u = $(UI.userInfo);
  if (u) u.textContent = session?.user?.email || "Eingeloggt";

  try {
    await loadProjects();
  } catch (e) {
    console.error("loadProjects failed:", e);
  }
}

// -----------------------------
// Session helpers
// -----------------------------
async function getSessionRetry(tries = 25, delayMs = 150) {
  for (let i = 0; i < tries; i++) {
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn("[auth] getSession error:", error);
    if (data?.session) return data.session;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

let uiLock = false;
async function syncUIFromSession(reason = "") {
  if (uiLock) return;
  uiLock = true;
  try {
    const session = await getSessionRetry(10, 120);
    if (!session) return renderLoggedOut(reason || "No session");
    return renderLoggedIn(session);
  } finally {
    uiLock = false;
  }
}

// -----------------------------
// AUTH actions
// -----------------------------
async function login() {
  const email = $("loginEmail")?.value?.trim() || "";
  const password = $("loginPassword")?.value || "";

  if (!email || !password) {
    alert("Bitte E-Mail und Passwort eingeben.");
    return;
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
    return;
  }

  // Nachziehen, weil Session manchmal erst kurz danach da ist
  const session = await getSessionRetry(25, 150);

  if (!session) {
    // Wenn storage nicht geht, erklären wir’s klar statt Endlosschleife
    if (!safeStorage.hasLS) {
      alert(
        "Login war ok, aber dieser Browser blockiert lokalen Speicher.\n" +
          "Dadurch kann die Anmeldung nicht dauerhaft gehalten werden.\n" +
          "Bitte Cookies/Website-Daten erlauben oder anderen Browser verwenden."
      );
    } else {
      alert(
        "Login war ok, aber die Session ist nicht verfügbar.\n" +
          "Bitte einmal Site-Daten der Render-Domain löschen und neu versuchen."
      );
    }
    renderLoggedOut("Session missing after login");
    return;
  }

  await renderLoggedIn(session);
}

async function register() {
  const email = $("loginEmail")?.value?.trim() || "";
  const password = $("loginPassword")?.value || "";

  if (!email || !password) {
    alert("Bitte E-Mail und Passwort eingeben.");
    return;
  }

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) alert(error.message);
  else alert("Registriert. Bitte E-Mail bestätigen (Spam prüfen).");
}

async function logout() {
  try {
    await sb.auth.signOut();
  } finally {
    renderLoggedOut("Signed out");
  }
}

// -----------------------------
// PROJECTS
// -----------------------------
async function createProject() {
  const title = $("npTitle")?.value?.trim() || "";
  if (!title) {
    alert("Titel fehlt");
    return;
  }

  const session = await getSessionRetry(10, 120);
  if (!session) {
    alert("Nicht eingeloggt.");
    renderLoggedOut("No session in createProject");
    return;
  }

  const meta = {
    editor: $("npEditor")?.value || "",
    cvd: $("npCvd")?.value || "",
    area: $("npArea")?.value || "",
    show: $("npShow")?.value || "",
    format: $("npFormat")?.value || "",
    target: $("npTarget")?.value || "",
    team: $("npTeam")?.value || "",
    short: $("npShort")?.value || "",
  };

  const { data, error } = await sb
    .from("projects")
    .insert([{ user_id: session.user.id, title, meta }])
    .select("id")
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  await loadProjects();

  // optional: direkt öffnen
  // window.location.href = `project.html?project_id=${encodeURIComponent(data.id)}`;
  console.log("[projects] created:", data?.id);
}

async function loadProjects() {
  const list = $(UI.projectList);
  if (!list) return;
  list.innerHTML = "";

  const session = await getSessionRetry(10, 120);
  if (!session) {
    list.textContent = "Nicht eingeloggt.";
    return;
  }

  // Nur eigene Projekte laden (wichtig!)
  const { data, error } = await sb
    .from("projects")
    .select("id,title,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    list.textContent = error.message;
    return;
  }

  if (!data || !data.length) {
    list.textContent = "Noch keine Projekte.";
    return;
  }

  data.forEach((p) => {
    const row = document.createElement("div");
    row.className = "project-item";
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.gap = "0.5rem";

    const t = document.createElement("div");
    t.textContent = p.title;
    t.style.flex = "1";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "small";
    btn.textContent = "Öffnen";
    btn.onclick = () => {
      window.location.href = `project.html?project_id=${encodeURIComponent(p.id)}`;
    };

    row.appendChild(t);
    row.appendChild(btn);
    list.appendChild(row);
  });
}

// -----------------------------
// STARTUP
// -----------------------------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initSupabase();

    // Bind buttons
    const bLogin = $(UI.btnLogin);
    const bReg = $(UI.btnRegister);
    const bOut = $(UI.btnLogout);
    const bCreate = $(UI.btnCreateProject);

    if (bLogin) bLogin.onclick = login;
    if (bReg) bReg.onclick = register;
    if (bOut) bOut.onclick = logout;
    if (bCreate) bCreate.onclick = createProject;

    // Auth events: kein refreshUI-Spam
    sb.auth.onAuthStateChange((event, session) => {
      console.log("[auth]", event, !!session);

      if (event === "INITIAL_SESSION") {
        if (session) renderLoggedIn(session);
        else renderLoggedOut("INITIAL_SESSION without session");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (session) renderLoggedIn(session);
        else syncUIFromSession("Auth event without session");
        return;
      }

      if (event === "SIGNED_OUT") {
        renderLoggedOut("SIGNED_OUT");
        return;
      }
    });

    // Initial sync (mit Retry)
    await syncUIFromSession("startup");
  } catch (e) {
    console.error(e);
    alert(String(e?.message || e));
  }
});
