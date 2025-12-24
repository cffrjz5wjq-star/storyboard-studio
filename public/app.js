const API_BASE = "/api";

async function loadProjects() {
  const res = await fetch(`${API_BASE}/projects`);
  const projects = await res.json();

  const list = document.getElementById("project-list");
  list.innerHTML = "";

  projects.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    list.appendChild(li);
  });
}

async function saveProject() {
  const name = document.getElementById("project-name").value;

  if (!name) return alert("Projektname fehlt");

  await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      data: { created: Date.now() }
    })
  });

  document.getElementById("project-name").value = "";
  loadProjects();
}

document.addEventListener("DOMContentLoaded", loadProjects);
