import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const app = express();
const port = process.env.PORT || 4000;
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "2mb" }));

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Fallback demo store. Replace with Supabase automatically when credentials are configured.
const memoryProjects = [];
const templates = [
  { id: "cinematic-opener", name: "Cinematic Opener", category: "Cinematic", description: "Opening dramatis dengan judul besar.", duration: 10, ratio: "9:16", accent: "#d6a85f" },
  { id: "kinetic-type", name: "Kinetic Typography", category: "Typography", description: "Teks dinamis dengan gerakan cepat.", duration: 15, ratio: "9:16", accent: "#8b9cff" },
  { id: "product-promo", name: "Product Promo", category: "Produk", description: "Showcase produk dengan komposisi premium.", duration: 20, ratio: "9:16", accent: "#e7b95d" },
  { id: "explainer", name: "Explainer", category: "Edukasi", description: "Penjelasan visual yang rapi dan mudah diikuti.", duration: 30, ratio: "16:9", accent: "#62c8a6" },
  { id: "cartoon-motion", name: "Cartoon Motion", category: "Kartun", description: "Gerakan ilustrasi ceria untuk konten edukasi.", duration: 20, ratio: "9:16", accent: "#f08d82" }
];

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(100),
  template_id: z.string().optional().nullable(),
  duration: z.number().int().min(5).max(180).default(15),
  ratio: z.enum(["9:16", "16:9", "1:1"]).default("9:16")
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "bang-motion-studio-api", database: hasSupabase ? "supabase" : "memory-demo" });
});

app.get("/api/templates", (_req, res) => res.json({ data: templates }));

app.get("/api/projects", async (_req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  }
  return res.json({ data: [...memoryProjects].sort((a,b) => b.created_at.localeCompare(a.created_at)) });
});

app.post("/api/projects", async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Input tidak valid", details: parsed.error.flatten() });

  const payload = {
    id: randomUUID(),
    title: parsed.data.title,
    template_id: parsed.data.template_id || null,
    duration: parsed.data.duration,
    ratio: parsed.data.ratio,
    status: "draft",
    timeline: { scenes: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    const { data, error } = await supabase.from("projects").insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }
  memoryProjects.push(payload);
  return res.status(201).json({ data: payload });
});

app.get("/api/projects/:id/assets", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Supabase belum dikonfigurasi." });
  const { data, error } = await supabase.from("assets").select("*").eq("project_id", req.params.id).order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data });
});

app.post("/api/projects/:id/assets", express.raw({ type: "application/octet-stream", limit: "4mb" }), async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Supabase belum dikonfigurasi." });
  const projectId = req.params.id;
  const fileName = String(req.headers["x-file-name"] || "image-upload").slice(0, 180);
  const mimeType = String(req.headers["x-file-type"] || "");
  const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const audioTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac"];
  const assetType = imageTypes.includes(mimeType) ? "image" : audioTypes.includes(mimeType) ? "audio" : null;
  if (!assetType) return res.status(400).json({ error: "Format file tidak didukung." });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0 || req.body.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: "File kosong atau melebihi 4 MB." });
  }
  const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (projectError || !project) return res.status(404).json({ error: "Proyek tidak ditemukan." });

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${projectId}/${randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("motion-assets").upload(objectPath, req.body, {
    contentType: mimeType,
    upsert: false
  });
  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data: publicData } = supabase.storage.from("motion-assets").getPublicUrl(objectPath);
  const { data: asset, error: assetError } = await supabase.from("assets").insert({
    project_id: projectId,
    file_name: fileName,
    file_url: publicData.publicUrl,
    asset_type: assetType,
    metadata: { mime_type: mimeType, size: req.body.length, storage_path: objectPath }
  }).select().single();

  if (assetError) {
    await supabase.storage.from("motion-assets").remove([objectPath]);
    return res.status(500).json({ error: assetError.message });
  }
  return res.status(201).json({ data: asset });
});

app.get("/api/projects/:id", async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase.from("projects").select("*").eq("id", req.params.id).single();
    if (error) return res.status(404).json({ error: "Proyek tidak ditemukan" });
    return res.json({ data });
  }
  const project = memoryProjects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Proyek tidak ditemukan" });
  return res.json({ data: project });
});

app.put("/api/projects/:id", async (req, res) => {
  const patchSchema = z.object({
    title: z.string().trim().min(1).max(100).optional(),
    duration: z.number().int().min(5).max(180).optional(),
    ratio: z.enum(["9:16", "16:9", "1:1"]).optional(),
    timeline: z.record(z.any()).optional()
  }).strict();
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Input tidak valid", details: parsed.error.flatten() });

  const patch = { ...parsed.data, updated_at: new Date().toISOString() };
  if (supabase) {
    const { data, error } = await supabase.from("projects").update(patch).eq("id", req.params.id).select().single();
    if (error) return res.status(404).json({ error: "Proyek tidak ditemukan" });
    return res.json({ data });
  }
  const index = memoryProjects.findIndex(p => p.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Proyek tidak ditemukan" });
  memoryProjects[index] = { ...memoryProjects[index], ...patch };
  return res.json({ data: memoryProjects[index] });
});

app.delete("/api/projects/:id", async (req, res) => {
  if (supabase) {
    const { error } = await supabase.from("projects").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  const index = memoryProjects.findIndex(p => p.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "Proyek tidak ditemukan" });
  memoryProjects.splice(index, 1);
  return res.json({ ok: true });
});

// AI generator remains a later development stage.
app.post("/api/ai/generate", (_req, res) => res.status(501).json({ error: "AI generator belum diaktifkan." }));

app.get("/api/projects/:id/renders", async (req,res) => {
  if (!supabase) return res.status(503).json({ error:"Supabase belum dikonfigurasi." });
  const { data,error } = await supabase.from("renders").select("*").eq("project_id",req.params.id).order("created_at",{ascending:false}).limit(10);
  if (error) return res.status(500).json({ error:error.message });
  return res.json({ data });
});

app.post("/api/render", async (req,res) => {
  const projectId = String(req.body?.projectId || "");
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return res.status(400).json({ error:"projectId tidak valid." });
  if (!process.env.RENDERER_URL || !process.env.RENDER_SECRET) {
    return res.status(503).json({ error:"Renderer belum dikonfigurasi di backend." });
  }
  try {
    const response = await fetch(`${process.env.RENDERER_URL.replace(/\/$/,"")}/render`, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "x-render-secret":process.env.RENDER_SECRET },
      body:JSON.stringify({ projectId })
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok) return res.status(response.status).json({ error:result.error || "Gagal mengirim pekerjaan render." });
    return res.status(202).json({ ok:true,status:"accepted",message:"Render masuk antrean.", ...result });
  } catch (error) {
    return res.status(502).json({ error:"Tidak dapat menghubungi server renderer: "+error.message });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Bang Motion Studio API listening on :${port}`);
  });
}

export default app;
