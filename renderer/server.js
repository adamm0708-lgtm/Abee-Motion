import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RENDER_SECRET"];
for (const key of required) {
  if (!process.env[key]) console.warn(`Missing environment variable: ${key}`);
}
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;
const bucket = process.env.RENDER_BUCKET || "motion-renders";
const FPS = 30;

const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" }[c]));
const mimeFromUrl = (url) => {
  const ext = new URL(url).pathname.split(".").pop().toLowerCase();
  return ({ jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp", gif:"image/gif" })[ext] || "image/png";
};

function atFrame(layer, time) {
  const frames = [...(layer.keyframes || [])].sort((a,b) => a.t-b.t);
  if (!frames.length) return { x:layer.x ?? 50, y:layer.y ?? 50, scale:layer.scale ?? 1, rotation:layer.rotation ?? 0, opacity:layer.opacity ?? 100 };
  if (time <= frames[0].t) return frames[0];
  if (time >= frames[frames.length-1].t) return frames[frames.length-1];
  const right = frames.findIndex(f => f.t >= time);
  const a = frames[right-1], b = frames[right];
  const p = (time-a.t) / Math.max(0.0001, b.t-a.t);
  const ease = layer.ease || "power2.inOut";
  let q = p;
  if (ease === "power2.in") q = p*p;
  else if (ease === "power2.out") q = 1-(1-p)*(1-p);
  else if (ease === "power2.inOut") q = p < .5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
  const mix = key => Number(a[key] ?? layer[key] ?? 0) + (Number(b[key] ?? layer[key] ?? 0)-Number(a[key] ?? layer[key] ?? 0))*q;
  return { x:mix("x"), y:mix("y"), scale:mix("scale"), rotation:mix("rotation"), opacity:mix("opacity") };
}

async function fetchDataUri(url, cache) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Gagal mengambil aset: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const uri = `data:${response.headers.get("content-type") || mimeFromUrl(url)};base64,${bytes.toString("base64")}`;
  cache.set(url, uri);
  return uri;
}

function makeSvg(layers, time, width, height, imageCache) {
  const parts = [];
  for (const layer of layers) {
    if (layer.visible === false || layer.type === "audio") continue;
    const start = Number(layer.start || 0), end = Number(layer.end ?? 15);
    if (time < start || time > end) continue;
    const v = atFrame(layer, time);
    const x = v.x / 100 * width, y = v.y / 100 * height;
    const opacity = clamp(v.opacity, 0, 100) / 100;
    const scale = clamp(v.scale, 0.01, 10);
    const color = esc(layer.color || "#ffffff");
    const transform = `translate(${x} ${y}) rotate(${v.rotation || 0}) scale(${scale})`;
    if (layer.type === "text") {
      const size = Math.max(16, Math.round(width * 0.075));
      parts.push(`<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${size}" fill="${color}" opacity="${opacity}">${esc(layer.text || "Teks baru")}</text>`);
    } else if (layer.type === "shape") {
      const radius = Math.min(width,height) * 0.13;
      parts.push(`<circle cx="0" cy="0" r="${radius}" fill="${color}" opacity="${opacity}"/>`);
    } else if (layer.type === "image" && imageCache.has(layer.id)) {
      const uri = imageCache.get(layer.id);
      const boxW = width * 0.72, boxH = height * 0.72;
      parts.push(`<image href="${uri}" x="${-boxW/2}" y="${-boxH/2}" width="${boxW}" height="${boxH}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}"/>`);
    }
    if (parts.length) {
      const last = parts.pop();
      parts.push(`<g transform="${transform}">${last}</g>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#111318"/>${parts.join("")}</svg>`;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio:["ignore","ignore","pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk.toString(); if (stderr.length > 12000) stderr = stderr.slice(-12000); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`FFmpeg gagal (code ${code}): ${stderr.slice(-5000)}`)));
  });
}

async function renderProject(projectId) {
  if (!supabase) throw new Error("Supabase belum dikonfigurasi.");
  const { data: project, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
  if (error || !project) throw new Error("Proyek tidak ditemukan.");
  const timeline = project.timeline || {};
  const layers = Array.isArray(timeline.layers) ? timeline.layers : [];
  const duration = clamp(timeline.duration ?? project.duration ?? 15, 5, 60);
  const ratio = timeline.ratio || project.ratio || "9:16";
  const [width,height] = ratio === "16:9" ? [1280,720] : ratio === "1:1" ? [900,900] : [720,1280];
  const jobId = randomUUID();
  const { data: render, error: insertError } = await supabase.from("renders").insert({ project_id:projectId, status:"processing", progress:0 }).select().single();
  if (insertError) throw new Error(insertError.message);

  const dir = await mkdtemp(path.join(os.tmpdir(), "bangmotion-"));
  try {
    const frameDir = path.join(dir,"frames");
    await mkdir(frameDir);
    const imageCache = new Map();
    for (const layer of layers.filter(l => l.type === "image" && l.imageSrc)) {
      imageCache.set(layer.id, await fetchDataUri(layer.imageSrc, new Map()));
    }
    const totalFrames = Math.ceil(duration * FPS);
    for (let i=0; i<totalFrames; i++) {
      const svg = makeSvg(layers, i/FPS, width, height, imageCache);
      await sharp(Buffer.from(svg)).png().toFile(path.join(frameDir,`frame-${String(i).padStart(6,"0")}.png`));
      if (i % 90 === 0) await supabase.from("renders").update({ progress:Math.round(i/totalFrames*70) }).eq("id",render.id);
    }

    const audioLayers = layers.filter(l => l.type === "audio" && l.audioSrc && l.visible !== false && Number(l.end ?? duration) > Number(l.start || 0));
    const args = ["-y","-framerate",String(FPS),"-i",path.join(frameDir,"frame-%06d.png")];
    const filters = [];
    audioLayers.forEach((layer,index) => args.push("-i",path.join(dir,`audio-${index}.bin`)));
    for (let i=0; i<audioLayers.length; i++) {
      const layer = audioLayers[i];
      const start = clamp(layer.start || 0,0,duration);
      const end = clamp(layer.end ?? duration,start,duration);
      const clipDuration = Math.max(.1,end-start);
      const volume = clamp(layer.volume ?? 80,0,100)/100;
      const fadeIn = clamp(layer.fadeIn ?? 0,0,clipDuration);
      const fadeOut = clamp(layer.fadeOut ?? 0,0,clipDuration);
      let chain = `[${i+1}:a]atrim=0:${clipDuration.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${Math.round(start*1000)}|${Math.round(start*1000)},volume=${volume}`;
      if (fadeIn > 0) chain += `,afade=t=in:st=0:d=${fadeIn}`;
      if (fadeOut > 0) chain += `,afade=t=out:st=${Math.max(0,clipDuration-fadeOut)}:d=${fadeOut}`;
      filters.push(chain+`[a${i}]`);
    }
    if (audioLayers.length) {
      filters.push(audioLayers.map((_,i)=>`[a${i}]`).join("")+`amix=inputs=${audioLayers.length}:duration=longest:dropout_transition=0[aout]`);
      args.push("-filter_complex",filters.join(";"),"-map","0:v","-map","[aout]");
    } else {
      args.push("-map","0:v","-an");
    }
    args.push("-t",String(duration),"-c:v","libx264","-preset","veryfast","-pix_fmt","yuv420p","-r",String(FPS),"-movflags","+faststart");
    const outputPath = path.join(dir,"output.mp4");
    args.push(outputPath);

    for (let i=0; i<audioLayers.length; i++) {
      const response = await fetch(audioLayers[i].audioSrc);
      if (!response.ok) throw new Error("Gagal mengunduh salah satu file audio.");
      await writeFile(path.join(dir,`audio-${i}.bin`),Buffer.from(await response.arrayBuffer()));
    }
    await runFfmpeg(args);
    await supabase.from("renders").update({ progress:90 }).eq("id",render.id);
    const video = await readFile(outputPath);
    const objectPath = `${projectId}/${jobId}.mp4`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath,video,{ contentType:"video/mp4", upsert:true });
    if (uploadError) throw new Error(uploadError.message);
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    await supabase.from("renders").update({ status:"completed",progress:100,output_url:publicData.publicUrl,finished_at:new Date().toISOString() }).eq("id",render.id);
    await supabase.from("projects").update({ status:"completed" }).eq("id",projectId);
    return { renderId:render.id, url:publicData.publicUrl };
  } catch (error) {
    await supabase.from("renders").update({ status:"failed",error_message:String(error.message || error),finished_at:new Date().toISOString() }).eq("id",render.id);
    throw error;
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
}

app.get("/health",(_req,res)=>res.json({ok:true,service:"bang-motion-renderer"}));
app.post("/render",async(req,res)=>{
  if (!process.env.RENDER_SECRET || req.headers["x-render-secret"] !== process.env.RENDER_SECRET) return res.status(401).json({error:"Unauthorized"});
  const projectId = String(req.body?.projectId || "");
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return res.status(400).json({error:"projectId tidak valid."});
  if (!supabase) return res.status(503).json({error:"Supabase belum dikonfigurasi."});
  res.status(202).json({ok:true,status:"accepted",message:"Render diterima. Pantau status melalui API proyek."});
  renderProject(projectId).catch(error=>console.error("Render error:",error));
});

const port = process.env.PORT || 8080;
app.listen(port,()=>console.log(`Bang Motion Renderer listening on :${port}`));
