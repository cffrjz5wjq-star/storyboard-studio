"use strict";

const path = require("path");
const express = require("express");

const app = express();
app.use(express.json());

// 1) Konfig für den Browser (NUR anon + url, niemals service_role!)
app.get("/config", (req, res) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables",
    });
  }

  res.json({ SUPABASE_URL, SUPABASE_ANON_KEY });
});

// 2) Static Files (public/)
app.use(express.static(path.join(__dirname, "public")));

// 3) Fallback -> index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Storyboard Studio läuft auf Port ${port}`);
});
