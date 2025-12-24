// server.js
"use strict";

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// --- Basics
app.use(express.json());

// --- Pfade
const publicDir = path.join(__dirname, "public");

// 1) public/ (index.html, project.html etc.)
app.use(express.static(publicDir));

// 2) Root-Dateien (app.js, styles.css, ggf. assets)
//    (Wenn du das nicht willst, sag Bescheid, dann machen wir einzelne Routes.)
app.use(express.static(__dirname));

// --- Health
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

// --- Config für den Browser (NUR public values)
app.get("/config", (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: "Missing env vars on server",
      missing: {
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_ANON_KEY: !SUPABASE_ANON_KEY,
      },
    });
  }

  res.json({ SUPABASE_URL, SUPABASE_ANON_KEY });
});

// --- SPA Fallback: alles andere -> public/index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
