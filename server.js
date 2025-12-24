"use strict";

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Public ausliefern
app.use(express.static(path.join(__dirname, "public")));

// Frontend-Konfig (nur ANON + URL)
app.get("/config", (req, res) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY on server environment.",
    });
  }

  res.json({ SUPABASE_URL, SUPABASE_ANON_KEY });
});

// optional health
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server listening on", PORT));
