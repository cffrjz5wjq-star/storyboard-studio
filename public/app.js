"use strict";

let sb;

const $ = (id) => document.getElementById(id);

function show(id, on) {
  const el = $(id);
  if (!el) return console.warn("show(): missing", id);
  el.classList.toggle("hidden", !on);
}

function canUseLocalStorage() {
  try {
    const k = "__sb_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

async function initSupabase() {
  if (!window.supabase) throw new Error("Supabase JS not loaded (window.supabase missing).");

  const res = await fetch("/config", { cache: "no-store" });
  if (!res.ok) throw new Error(`/config failed: ${res.status} ${await res.text()}`);
  const cfg = await res.json();

  // Auth-Config explizit setzen (kein „Defaults raten“)
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: canUseLocalStorage() ? window.localStorage : undefined,
    },
  });

  console.log("[SB] init ok", {
    url: cfg.SUPABASE_URL,
    hasKey: !!cfg.SUPABASE_ANON_KEY,
    localStorageOk: canUseLocalStorage(),
  });
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

  // projects laden darf die UI nicht killen
  try {
    await loadProjects();
  } catch (e) {
    console.error("[SB] loadProjects crashed:", e);
    alert("Eingeloggt, aber loadProjects() ist abgestürzt: " + (e?.message || e));
  }
}

async function getSessionWithRetry(tries = 20, delayMs = 250) {
  for (let i = 0; i < tries; i++) {
    const { data, error } = await sb.auth.getSession();
    if (error) console.error("[SB] getSession error:", error);
    if (data?.session) return data.session;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function refreshUI() {
  const session = await getSessionWithRetry(8, 150);
  console.log("[SB] refreshUI session:", !!session);
  if (!session) return renderLoggedOut();
  await renderLoggedIn(session);
}

// ---------- Auth ----------
async function login() {
  const email = ($("loginEmail")?.value || "").trim();
  const password = $("loginPassword")?.value || "";

  console.log("[SB] login start", { email });

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  console.log("[SB] signIn result", { hasUser: !!data?.user, hasSession: !!data?.session, error });

  if (error) {
    alert(error.message);
    return;
  }

  // Wenn Session direkt da ist: sofort UI umschalten
  if (data?.session) {
    await renderLoggedIn(data.session);
    return;
  }

  // Sonst: nochmal Session ziehen
  const session = await getSessionWithRetry(20, 250);
  console.log("[SB] post-login session after retry:", !!session);

  if (session) {
    await renderLoggedIn(session);
    return;
  }

  // Jetzt ist es eindeutig Storage/Session-Persistenz
  const lsOk = canUseLocalStorage();
  let lsKeys = [];
  try {
    lsKeys = Object.keys(localStorage || {}).filter((k) => k.includes("supabase") || k.includes("sb-"));
  } catch {}

  alert(
    "Login war anscheinend erfolgreich, aber es gibt keine Session im Browser.\n\n" +
      "localStorage ok: " + lsOk + "\n" +
      "localStorage keys (supabase/sb-*): " + (lsKeys.join(", ") || "-") + "\n\n" +
      "Bitte Console öffnen: dort stehen die Debug-Logs [SB]."
  );
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

  // Hinweis: erfordert DB-Spalte "data" (jsonb). Sonst kommt der bekannte Fehler.
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

  const { data, error } = await sb.from("projects").select("id,title").order("created_at", { ascending: false });

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

    $("btnLogin") && ($("btnLogin").onclick = login);
    $("btnRegister") && ($("btnRegister").onclick = register);
    $("btnLogout") && ($("btnLogout").onclick = logout);
    $("btnCreateProject") && ($("btnCreateProject").onclick = createProject);

    sb.auth.onAuthStateChange((event) => {
      console.log("[SB] onAuthStateChange:", event);
      refreshUI();
    });

    await refreshUI();
  } catch (e) {
    console.error(e);
    alert(String(e.message || e));
  }
});
