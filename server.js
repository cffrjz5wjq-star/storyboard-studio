// server.js
// Minimaler Express-Server für Storyboard Studio

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 10000;

// --------------------------------------------------
// Supabase Client (global, serverseitig)
// --------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------------------------------------------
// Statisches Frontend ausliefern
// --------------------------------------------------
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "storyboard-studio" });
});

// --------------------------------------------------
// PROJECT SAVE (Online)
// --------------------------------------------------
app.post("/api/projects/save", async (req, res) => {
  try {
    const { projectId, ownerId, name, data } = req.body;

    if (!ownerId || !name) {
      return res.status(400).json({ error: "ownerId and name required" });
    }

    const payload = {
      owner_id: ownerId,
      name,
      data
    };

    const query = projectId
      ? supabase
          .from("projects")
          .update(payload)
          .eq("id", projectId)
          .select("id")
          .single()
      : supabase
          .from("projects")
          .insert(payload)
          .select("id")
          .single();

    const { data: row, error } = await query;

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ projectId: row.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// --------------------------------------------------
// PROJECT LOAD (Online)
// --------------------------------------------------
app.get("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("projects")
      .select("id, owner_id, name, data, updated_at")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// --------------------------------------------------
// FALLBACK – Single Page App
// --------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// --------------------------------------------------
// SERVER START
// --------------------------------------------------
app.listen(PORT, () => {
  console.log(`Storyboard Studio läuft auf Port ${PORT}`);
});
