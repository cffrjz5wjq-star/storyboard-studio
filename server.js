"use strict";

const path = require("path");
const express = require("express");

const app = express();
app.use(express.json());

// Frontend ausliefern
app.use(express.static(path.join(__dirname, "public")));

// Config fürs Frontend (keine Secrets!)
app.get("/config", (req, res) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: "Supabase config missing" });
  }
  res.json({ SUPABASE_URL, SUPABASE_ANON_KEY });
});

// Fallback
app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Storyboard Studio läuft auf Port", port);
});
