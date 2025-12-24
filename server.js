"use strict";

const express = require("express");
const path = require("path");

const app = express();

// Render Env Vars
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Minimal check (damit du im Log sofort siehst, wenn was fehlt)
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing env vars: SUPABASE_URL / SUPABASE_ANON_KEY");
}

app.use(express.json());

// Static files aus /public
app.use(express.static(path.join(__dirname, "public")));

// Wichtig: Config fürs Frontend (NUR URL + ANON KEY, niemals SERVICE_ROLE_KEY)
app.get("/config", (req, res) => {
  res.json({
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  });
});

// Health Check
app.get("/health", (req, res) => res.status(200).send("ok"));

// Fallback: alles andere -> index.html (für späteres Routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Storyboard Studio läuft auf Port ${PORT}`));
