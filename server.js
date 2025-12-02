// server.js
// Minimaler Express-Server für Storyboard Studio

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Statisches Build aus /public ausliefern
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));


// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "storyboard-studio" });
});


// -------------------------------------------------------------
// SUPABASE TEST-ROUTE → WICHTIG: MUSS VOR DEM FALLBACK STEHEN!
// -------------------------------------------------------------
app.get("/test-supabase", async (req, res) => {
  try {
    const { createClient } = require("@supabase/supabase-js");

    const supabase = createClient(
      process.env.SUPABASE_URL,               // deine URL
      process.env.SUPABASE_SERVICE_ROLE_KEY  // dein geheimer Key
    );

    const { data, error } = await supabase
      .from("pg_tables")
      .select("*")
      .limit(1);

    res.json({
      connected: !error,
      error,
      data
    });

  } catch (err) {
    res.json({
      connected: false,
      error: err.message
    });
  }
});


// -------------------------------------------------------------
// FALLBACK – Single Page App (React/Vanilla)
// -------------------------------------------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});


// -------------------------------------------------------------
// SERVER STARTEN
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Storyboard Studio läuft auf Port ${PORT}`);
});
