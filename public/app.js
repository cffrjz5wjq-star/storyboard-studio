"use strict";

let sb;

const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle("hidden", !on);

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

  // Projekte laden ist nice-to-have – darf UI nicht blockieren
  try {
    await loadProjects();
  } catch (e) {
    console.error("loadProjects failed:", e);
  }
}

async function getSessionRetry(tries = 12, delayMs = 250) {
  for (let i = 0; i < tries; i++) {
    const { data, error } = await sb.auth.getSession();
    if (error) console.error("getSession error:", error);
    if (data?.session) return data.session;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function refreshUI() {
  const { data, error } = await sb.auth.getSession();
  if (error) console.error("refreshUI getSession error:", error);

  const session = data?.session;
  if (!session) return renderLoggedOut();
  return renderLoggedIn(session);
}

// ---------- AUTH ----------
async function login() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  console.log("[login] start", { email });

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.log("[login] error", error);
    alert(error.message);
    return;
  }

  // Wichtig: NICHT auf data.session verlassen – IMMER nachziehen
  const session = await getSessionRetry(12, 250);
  console.log("[login] session after retry:", !!session);

  if (!session) {
    alert(
      "Login war ok, aber Session wird im Browser nicht verfügbar.\n" +
        "Bitte teste einmal: Seite hart neu laden (Cmd+Shift+R), und in Chrome: Site-Daten löschen.\n" +
        "Wenn es dann geht, war es ein Storage/Cache-Thema."
    );
    return;
  }

  await renderLoggedIn(session);
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
  else alert("Registriert. Bitte E-Mail bestätigen (Spam prüfen).");
}

async function logout() {
  await sb.auth.signOut();
  renderLoggedOut();
}

// ---------- PROJECTS ----------
async function createProject() {
  const title = $("npTitle").value.trim();
  if (!title) return alert("Titel fehlt");

  const { data: sessData } = await sb.auth.getSession();
  const session = sessData?.session;
  if (!session) return alert("Nicht eingeloggt.");

  const meta = {
    editor: $("npEditor").value,
    cvd: $("npCvd").value,
    area: $("npArea").value,
    show: $("npShow").value,
    format: $("npFormat").value,
    target: $("npTarget").value,
    team: $("npTeam").value,
    short: $("npShort").value,
  };

  const { error } = await sb
    .from("projects")
    .insert([{ user_id: session.user.id, title, meta }]);

  if (error) alert(error.message);
  else await loadProjects();
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

// ---------- START ----------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initSupabase();

    $("btnLogin").onclick = login;
    $("btnRegister").onclick = register;
    $("btnLogout").onclick = logout;
    $("btnCreateProject").onclick = createProject;

    // Wichtig: Auth-State-Events sauber behandeln
    sb.auth.onAuthStateChange((event) => {
      console.log("[auth]", event);
      refreshUI();
    });

    await refreshUI();
  } catch (e) {
    console.error(e);
    alert(String(e.message || e));
  }
});
