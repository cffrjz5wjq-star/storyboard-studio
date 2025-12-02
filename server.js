// server.js
// Minimaler Express-Server für Storyboard Studio

const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien aus /public ausliefern
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Health-Check (kannst du z.B. in Render bei "Health Check Path" eintragen)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "storyboard-studio" });
});

// Fallback: immer index.html zurückgeben (Single-Page-App)
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Server starten
app.get("/test-supabase", async (req, res) => {
  try {
    const { createClient } = require("@supabase/supabase-js");

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.from("pg_tables").select("*").limit(1);

    res.json({
      connected: error ? false : true,
      error,
      data,
    });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});
app.listen(PORT, () => {
  console.log(`Storyboard Studio läuft auf Port ${PORT}`);
});
