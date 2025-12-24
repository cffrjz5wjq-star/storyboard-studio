// public/app.js
(() => {
  const S = {
    // Buttons
    saveBtn: "#btnCreateProject",
    clearBtn: "#btnResetProjectForm",
    newTop: "#btnNewProjectTop",
    newTile: "#btnNewProjectTile",

    // Form fields (deine IDs)
    name: "#npTitle",
    redaktion: "#npEditor",
    cvd: "#npCvd",
    bereich: "#npArea",
    sendung: "#npShow",
    format: "#npFormat",
    zielgruppe: "#npTarget",
    team: "#npTeam",
    kurzbeschreibung: "#npShort",

    // Right panel list
    listContainer: "#projectList",

    // Anzeige aktuelles Projekt
    currentSubtitle: "#currentProjectSubtitle",
  };

  const el = (sel) => document.querySelector(sel);

  const state = {
    selectedId: null,
    projects: [],
  };

  function getFormPayload() {
    const name = (el(S.name)?.value ?? "").trim();
    return {
      name,
      data: {
        redaktion: el(S.redaktion)?.value ?? "",
        cvd: el(S.cvd)?.value ?? "",
        bereich: el(S.bereich)?.value ?? "",
        sendung: el(S.sendung)?.value ?? "",
        format: el(S.format)?.value ?? "",
        zielgruppe: el(S.zielgruppe)?.value ?? "",
        team: el(S.team)?.value ?? "",
        kurzbeschreibung: el(S.kurzbeschreibung)?.value ?? "",
      },
    };
  }

  function setFormFromProject(project) {
    state.selectedId = project?.id ?? null;

    if (el(S.currentSubtitle)) {
      el(S.currentSubtitle).textContent = project?.name
        ? `Ausgewählt: ${project.name}`
        : "Noch kein Projekt ausgewählt.";
    }

    if (el(S.name)) el(S.name).value = project?.name ?? "";

    const d = project?.data ?? {};
    if (el(S.redaktion)) el(S.redaktion).value = d.redaktion ?? "";
    if (el(S.cvd)) el(S.cvd).value = d.cvd ?? "";
    if (el(S.bereich)) el(S.bereich).value = d.bereich ?? "";
    if (el(S.sendung)) el(S.sendung).value = d.sendung ?? "";
    if (el(S.format)) el(S.format).value = d.format ?? "";
    if (el(S.zielgruppe)) el(S.zielgruppe).value = d.zielgruppe ?? "";
    if (el(S.team)) el(S.team).value = d.team ?? "";
    if (el(S.kurzbeschreibung)) el(S.kurzbeschreibung).value = d.kurzbeschreibung ?? "";
  }

  function clearForm() {
    state.selectedId = null;

    if (el(S.currentSubtitle)) {
      el(S.currentSubtitle).textContent = "Noch kein Projekt ausgewählt.";
    }

    [
      S.name, S.redaktion, S.cvd, S.bereich, S.sendung,
      S.format, S.zielgruppe, S.team, S.kurzbeschreibung
    ]
      .map(el)
      .filter(Boolean)
      .forEach((x) => (x.value = ""));
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    const txt = await res.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch {}
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    return json;
  }

  function renderProjectList() {
    const container = el(S.listContainer);
    if (!container) return;

    container.innerHTML = "";

    if (!state.projects.length) {
      const div = document.createElement("div");
      div.style.opacity = "0.7";
      div.textContent = "Noch kein Projekt gespeichert.";
      container.appendChild(div);
      return;
    }

    state.projects.forEach((p) => {
      const row = document.createElement("div");
      row.className = "project-item";

      const main = document.createElement("div");
      main.className = "project-item-main";

      const title = document.createElement("div");
      title.className = "project-item-title";
      title.textContent = p.name;
      title.style.cursor = "pointer";
      title.onclick = () => openProject(p.id);

      const meta = document.createElement("div");
      meta.className = "project-item-meta";
      meta.textContent = (p.data?.redaktion || p.data?.sendung || "").toString();

      main.appendChild(title);
      main.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "project-item-actions";

      const btn = document.createElement("button");
      btn.className = "small";
      btn.textContent = "Öffnen";
      btn.onclick = () => openProject(p.id);

      actions.appendChild(btn);

      row.appendChild(main);
      row.appendChild(actions);

      container.appendChild(row);
    });
  }

  async function loadProjects() {
    state.projects = await api("/api/projects");
    renderProjectList();
  }

  async function openProject(id) {
    const project = await api(`/api/projects/${id}`);
    setFormFromProject(project);
  }

  async function saveProject() {
    const payload = getFormPayload();
    if (!payload.name) {
      alert("Bitte Projekttitel ausfüllen.");
      return;
    }

    if (state.selectedId) {
      const updated = await api(`/api/projects/${state.selectedId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setFormFromProject(updated);
    } else {
      const created = await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFormFromProject(created);
    }

    await loadProjects();
  }

  function wire() {
    el(S.saveBtn)?.addEventListener("click", (e) => {
      e.preventDefault();
      saveProject().catch((err) => alert(`Speichern fehlgeschlagen: ${err.message}`));
    });

    el(S.clearBtn)?.addEventListener("click", (e) => {
      e.preventDefault();
      clearForm();
    });

    el(S.newTop)?.addEventListener("click", (e) => {
      e.preventDefault();
      clearForm();
      el(S.name)?.focus?.();
    });

    el(S.newTile)?.addEventListener("click", (e) => {
      e.preventDefault();
      clearForm();
      el(S.name)?.focus?.();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    wire();
    await loadProjects();
  });
})();
