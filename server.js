// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json({ limit: "5mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Supabase (Server-side, Service Role) ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Static frontend ---
app.use(express.static(path.join(__dirname, "public")));

// Healthcheck
app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

/**
 * DB table expected: public.projects
 * Columns (minimum):
 *  - id uuid primary key default gen_random_uuid()
 *  - name text not null
 *  - data jsonb not null default '{}'::jsonb
 *  - created_at timestamptz not null default now()
 *  - updated_at timestamptz not null default now()
 */

// List projects
app.get("/api/projects", async (_req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,data,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// Get single project
app.get("/api/projects/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("projects")
    .select("id,name,data,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

// Create project
app.post("/api/projects", async (req, res) => {
  const payload = req.body ?? {};
  const name = String(payload.name ?? "").trim();
  const data = payload.data ?? {};

  if (!name) return res.status(400).json({ error: "Missing project name" });

  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("projects")
    .insert([{ name, data, created_at: now, updated_at: now }])
    .select("id,name,data,created_at,updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(inserted);
});

// Update project
app.put("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  const payload = req.body ?? {};
  const name = String(payload.name ?? "").trim();
  const data = payload.data ?? {};

  if (!name) return res.status(400).json({ error: "Missing project name" });

  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from("projects")
    .update({ name, data, updated_at: now })
    .eq("id", id)
    .select("id,name,data,created_at,updated_at")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(updated);
});

// SPA fallback (optional)
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Storyboard Studio läuft auf Port ${port}`);
});
