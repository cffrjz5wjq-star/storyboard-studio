async function createProject() {
  const title = $("npTitle").value.trim();
  if (!title) return alert("Titel fehlt");

  const { data: sessData, error: sessErr } = await sb.auth.getSession();
  if (sessErr) console.error(sessErr);
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

  const { error } = await sb.from("projects").insert([
    { user_id: session.user.id, title, meta }
  ]);

  if (error) {
    alert(error.message);
    return;
  }

  await loadProjects();
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
      // Übergabe fürs nächste View: per URL (netz-agnostisch)
      window.location.href = `project.html?project_id=${encodeURIComponent(p.id)}`;
    };

    row.appendChild(t);
    row.appendChild(btn);
    list.appendChild(row);
  });
}
