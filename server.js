import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// ENV
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase ENV vars fehlen");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// GET alle Projekte
app.get("/api/projects", async (req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});

// POST neues Projekt
app.post("/api/projects", async (req, res) => {
  const { name, data } = req.body;

  const { data: result, error } = await supabase
    .from("projects")
    .insert([{ name, data }])
    .select()
    .single();

  if (error) return res.status(500).json(error);
  res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server läuft auf Port", PORT);
});
