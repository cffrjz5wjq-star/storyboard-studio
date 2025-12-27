"use strict";

const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Public staticfiles + Cache-Control für html/js/css
app.use(
  express.static(path.join(__dirname, "public"), {
    etag: false,
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith(".html") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".css")
      ) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);

// Frontend-config (nur anon key!)
app.get("/config", (req, res) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY on server environment.",
    });
  }

  res.json({ SUPABASE_URL, SUPABASE_ANON_KEY });
});

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server listening on", port));
