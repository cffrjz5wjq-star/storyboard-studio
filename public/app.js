// public/app.js
(() => {
  // Passe diese Selectors ggf. an deine echten IDs/Inputs an:
  const S = {
    // Buttons
    saveBtn: "#saveProjectBtn",
    clearBtn: "#clearFormBtn",

    // Form fields
    name: "#projectName",
    redaktion: "#redaktion",
    cvd: "#cvd",
    bereich: "#bereich",
    sendung: "#sendung",
    format: "#format",
    zielgruppe: "#zielgruppe",
    team: "#team",
    kurzbeschreibung: "#kurzbeschreibung",

    // Right panel list
    listContainer: "#projectList",

    // Optional: Anzeige aktuelles Projekt
    currentTitle: "#currentProjectTitle",
  };

  const el = (sel) => document.querySelector(sel);

  const state = {
    selectedId: null,
    projects: [],
  };

  function getFormData() {
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

  function setFormData(project) {
    state.selectedId = project?.id ?? null;
    if (el(S.currentTitle)) el(S.currentTitle).textContent = project?.name ?? "—";

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
    if (el(S.currentTitle)) el(S.currentTitle).textContent = "—";

    [S.name, S.redaktion, S.cvd, S.bereich, S.sendung, S.format, S.zielgruppe, S.team, S.kurzbeschreibung]
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
    if (!res.ok) {
      const msg = json?.error ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
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
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.gap = "10px";
      row.style.padding = "6px 0";

      const title = document.createElement("div");
      title.textContent = p.name;
      title.style.cursor = "pointer";
      title.onclick = () => openProject(p.id);

      const btn = document.createElement("button");
      btn.textContent = "Öffnen";
      btn.onclick = () => openProject(p.id);

      row.appendChild(title);
      row.appendChild(btn);

      container.appendChild(row);
    });
  }

  async function loadProjects() {
    state.projects = await api("/api/projects");
    renderProjectList();
  }

  async function openProject(id) {
    const project = await api(`/api/projects/${id}`);
    setFormData(project);
  }

  async function saveProject() {
    const payload = getFormData();
    if (!payload.name) {
      alert("Bitte Projektname ausfüllen.");
      return;
    }

    if (state.selectedId) {
      const updated = await api(`/api/projects/${state.selectedId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setFormData(updated);
    } else {
      const created = await api("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFormData(created);
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
  }

  async function init() {
    wire();
    await loadProjects();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => console.error(err));
  });
})();
