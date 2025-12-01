// app.js
// Logik für die Projektseite (project.html).
// Index/Login bleiben unberührt – wir prüfen zuerst, ob wir auf der Projektseite sind.

window.addEventListener("DOMContentLoaded", () => {
  const projectRoot = document.getElementById("projectRoot");
  if (!projectRoot) {
    // Auf anderen Seiten (z.B. index.html) nichts tun
    return;
  }

  /*************** Hilfsfunktionen ***************/
  const $ = (id) => document.getElementById(id);

  function loadActiveProject() {
    // Projekt kommt aus localStorage["sb_active_project"]
    // Fallback: Demo-Projekt, falls nichts gesetzt ist.
    const raw = localStorage.getItem("sb_active_project");
    if (!raw) {
      return {
        id: "demo",
        title: "Demo-Projekt",
        editor: "Redaktion",
        cvd: "CVD",
        area: "Bereich",
        show: "Sendung",
        format: "Format",
        length: "20",
        notes: "",
        takes: [
          {
            id: "t1",
            takeNumber: 1,
            in: "00:00:00",
            out: "00:00:06",
            persons: "",
            picture: "Einstieg / Totale",
            voice: "Test-Text für Sprecher.",
            notes: "",
            music: "",
            source: "",
            images: []
          }
        ]
      };
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("sb_active_project ist kaputt, nutze Fallback:", e);
      return null;
    }
  }

  function saveActiveProject() {
    if (!currentProject) return;
    localStorage.setItem("sb_active_project", JSON.stringify(currentProject));
  }

  function secondsToTimecode(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function estimateDurationFromText(text, wordsPerSecond = 3) {
    const words = (text || "").trim().split(/\s+/).filter(Boolean);
    return words.length / wordsPerSecond;
  }

  /*************** State ***************/
  let currentProject = loadActiveProject();
  if (!currentProject) {
    currentProject = {
      id: "empty",
      title: "",
      editor: "",
      cvd: "",
      area: "",
      show: "",
      format: "",
      length: "",
      notes: "",
      takes: []
    };
  }
  if (!Array.isArray(currentProject.takes)) currentProject.takes = [];

  /*************** Projekt-Metadaten ***************/
  function renderProjectMeta() {
    $("metaTitle").value = currentProject.title || "";
    $("metaEditor").value = currentProject.editor || "";
    $("metaCvd").value = currentProject.cvd || "";
    $("metaArea").value = currentProject.area || "";
    $("metaShow").value = currentProject.show || "";
    $("metaFormat").value = currentProject.format || "";
    $("metaLength").value = currentProject.length || "";
    $("projectNotes").value = currentProject.notes || "";
  }

  function readProjectMetaFromInputs() {
    currentProject.title = $("metaTitle").value.trim();
    currentProject.editor = $("metaEditor").value.trim();
    currentProject.cvd = $("metaCvd").value.trim();
    currentProject.area = $("metaArea").value.trim();
    currentProject.show = $("metaShow").value.trim();
    currentProject.format = $("metaFormat").value.trim();
    currentProject.length = $("metaLength").value.trim();
    currentProject.notes = $("projectNotes").value;
    currentProject.updatedAt = new Date().toISOString();
  }

  $("btnSaveProject").addEventListener("click", () => {
    readProjectMetaFromInputs();
    saveActiveProject();
    alert("Projekt gespeichert.");
  });

  $("btnDeleteProject").addEventListener("click", () => {
    const name = currentProject.title || "dieses Projekt";
    if (!confirm(`Willst du ${name} wirklich löschen?`)) return;

    const msg =
      "Hast du alle wichtigen Daten exportiert (PDF/CSV)?\n" +
      "Du kannst vorher z.B. die Seite drucken oder die Tabelle exportieren.";
    if (!confirm(msg + "\n\nTrotzdem endgültig löschen?")) return;

    localStorage.removeItem("sb_active_project");
    currentProject = null;
    window.location.href = "index.html";
  });

  /*************** Tabelle & Spalten-Toggle ***************/
  function toggleColumnVisibility(colName, visible) {
    const cells = document.querySelectorAll(`[data-col="${colName}"]`);
    cells.forEach((cell) => {
      if (visible) {
        cell.classList.remove("hidden-col");
      } else {
        cell.classList.add("hidden-col");
      }
    });
  }

  document.querySelectorAll("input[data-col-toggle]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const col = cb.getAttribute("data-col-toggle");
      toggleColumnVisibility(col, cb.checked);
    });
  });

  /*************** Takes + Bilder ***************/
  const hiddenImageInput = document.createElement("input");
  hiddenImageInput.type = "file";
  hiddenImageInput.accept = "image/*";
  let pendingImageTakeId = null;

  hiddenImageInput.addEventListener("change", () => {
    const file = hiddenImageInput.files[0];
    if (!file || !pendingImageTakeId) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const take = currentProject.takes.find((t) => t.id === pendingImageTakeId);
      if (!take) return;
      if (!Array.isArray(take.images)) take.images = [];
      if (take.images.length >= 4) {
        alert("Maximal 4 Bilder pro Take.");
        return;
      }
      take.images.push(dataUrl);
      saveActiveProject();
      renderTakesTable();
    };
    reader.readAsDataURL(file);
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-image]");
    if (btn) {
      pendingImageTakeId = btn.getAttribute("data-add-image");
      hiddenImageInput.value = "";
      hiddenImageInput.click();
    }
  });

  function openImagePreview(dataUrl) {
    const w = window.open("", "_blank", "width=1280,height=720");
    w.document.write(
      `<html><head><title>Bildvorschau</title></head>
       <body style="margin:0;display:flex;align-items:center;justify-content:center;background:#111;">
         <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;">
       </body></html>`
    );
  }

  function renderTakesTable() {
    const tbody = $("takesBody");
    tbody.innerHTML = "";

    currentProject.takes.forEach((take, index) => {
      if (!take.id) take.id = `take_${index}`;
      const tr = document.createElement("tr");

      function textCell(col, value, onInput) {
        const td = document.createElement("td");
        td.setAttribute("data-col", col);
        const input = document.createElement("input");
        input.type = "text";
        input.value = value || "";
        input.addEventListener("input", () => onInput(input.value));
        td.appendChild(input);
        tr.appendChild(td);
      }

      textCell("take", take.takeNumber || index + 1, (v) => {
        take.takeNumber = v;
        saveActiveProject();
      });
      textCell("in", take.in || "", (v) => {
        take.in = v;
        saveActiveProject();
      });
      textCell("out", take.out || "", (v) => {
        take.out = v;
        saveActiveProject();
      });
      textCell("persons", take.persons || "", (v) => {
        take.persons = v;
        saveActiveProject();
      });

      // Bild/Kamera
      {
        const td = document.createElement("td");
        td.setAttribute("data-col", "picture");
        const ta = document.createElement("textarea");
        ta.value = take.picture || "";
        ta.addEventListener("input", () => {
          take.picture = ta.value;
          saveActiveProject();
        });
        td.appendChild(ta);
        tr.appendChild(td);
      }

      // Sprechertext
      {
        const td = document.createElement("td");
        td.setAttribute("data-col", "voice");
        const ta = document.createElement("textarea");
        ta.value = take.voice || "";
        ta.addEventListener("input", () => {
          take.voice = ta.value;
          saveActiveProject();
        });
        td.appendChild(ta);
        tr.appendChild(td);
      }

      // Notizen
      {
        const td = document.createElement("td");
        td.setAttribute("data-col", "notes");
        const ta = document.createElement("textarea");
        ta.value = take.notes || "";
        ta.addEventListener("input", () => {
          take.notes = ta.value;
          saveActiveProject();
        });
        td.appendChild(ta);
        tr.appendChild(td);
      }

      // Musik
      textCell("music", take.music || "", (v) => {
        take.music = v;
        saveActiveProject();
      });

      // Herkunft
      textCell("source", take.source || "", (v) => {
        take.source = v;
        saveActiveProject();
      });

      // Bilder
      {
        const td = document.createElement("td");
        td.setAttribute("data-col", "images");
        td.innerHTML = `
          <div class="images-cell">
            <div class="images-thumbs" id="thumbs-${take.id}"></div>
            <button type="button" class="small" data-add-image="${take.id}">
              Bild hinzufügen
            </button>
          </div>
        `;
        tr.appendChild(td);
      }

      tbody.appendChild(tr);

      // Thumbnails einfüllen
      const thumbsDiv = document.getElementById(`thumbs-${take.id}`);
      if (thumbsDiv) {
        thumbsDiv.innerHTML = "";
        (take.images || []).forEach((imgData, i) => {
          const img = document.createElement("img");
          img.src = imgData;
          img.title = `Bild ${i + 1}`;
          img.addEventListener("click", () => openImagePreview(imgData));
          thumbsDiv.appendChild(img);
        });
      }
    });
  }

  /*************** Timecodes neu berechnen ***************/
  $("btnRecalcTimecodes").addEventListener("click", () => {
    let currentSeconds = 0;
    currentProject.takes.forEach((take) => {
      const dur = estimateDurationFromText(take.voice || take.speakerText, 3);
      take.in = secondsToTimecode(currentSeconds);
      currentSeconds += dur;
      take.out = secondsToTimecode(currentSeconds);
    });
    saveActiveProject();
    renderTakesTable();
    alert("Timecodes anhand des Sprechertextes neu berechnet (3 Wörter/Sek.).");
  });

  /*************** Initialisierung ***************/
  renderProjectMeta();
  renderTakesTable();
});
// app.js

// Kleine Hilfsfunktionen
function safeKey(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Fehler beim Lesen von", key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Angemeldeter User (wie bei dir auf dem Dashboard angezeigt)
function getCurrentUserEmail() {
  const session = loadJSON("sb_session", null);
  if (session && session.email) return session.email;
  // Fallback, wenn du noch kein Login fertig hast
  return "local_guest";
}

// Zentrales Projekt-Open
function openProjectById(projectId) {
  const email = getCurrentUserEmail();
  const projectsKey = "sb_projects_" + safeKey(email);
  const projects = loadJSON(projectsKey, []);

  const project = projects.find(p => p.id === projectId);
  if (!project) {
    alert("Projekt mit dieser ID wurde nicht gefunden.");
    return;
  }

  // aktives Projekt im LocalStorage merken
  saveJSON("sb_active_project", project);

  // zur Editor-Seite springen
  window.location.href = "project.html";
}
