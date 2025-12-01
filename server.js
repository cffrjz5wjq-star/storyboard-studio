// server.js
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Request-Body als JSON erlauben (falls du später APIs brauchst)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien aus /public
app.use(express.static(path.join(__dirname, "public")));

// Startseite: Index
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Projektseite: Editor
// WICHTIG: diese Route VOR einer evtl. Catch-All-Route definieren!
app.get("/project.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "project.html"));
});

// (Optional) Admin-Seite, falls du später eine eigene HTML-Datei hast
// app.get("/admin.html", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "admin.html"));
// });

// Fallback: alles, was wir nicht kennen, auf die Startseite schicken.
// Wenn du irgendwann ein Frontend-Routing hast (z.B. React), bleibt das hilfreich.
// Diese Route MUSS als letzte kommen.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Storyboard Studio Server läuft auf Port ${PORT}`);
});
