// Bang Motion Studio editor: browser-local WebM export entry point.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, Play, Pause, Plus, Type, Square, Image, Music2, Trash2, Copy, Eye, EyeOff, Lock, Unlock, Diamond, Download, Monitor, Smartphone, RectangleHorizontal, Circle, Undo2, Redo2 } from "lucide-react";

const initialLayers = [
  { id: 1, name: "Judul utama", type: "text", text: "MAKE IT MOVE.", x: 50, y: 48, scale: 1, rotation: 0, opacity: 100, color: "#f4d28d", start: 0, end: 8, visible: true, locked: false, ease:"power2.inOut", keyframes: [{t:0,x:50,y:48,scale:0.8,rotation:-8,opacity:0},{t:4,x:50,y:42,scale:1.15,rotation:0,opacity:100}] },
  { id: 2, name: "Subjudul", type: "text", text: "BANG MOTION STUDIO", x: 50, y: 64, scale: 1, rotation: 0, opacity: 85, color: "#ffffff", start: 1, end: 8, visible: true, locked: false, ease:"power2.inOut", keyframes: [{t:1,x:50,y:64,scale:0.8,rotation:0,opacity:0},{t:2,x:50,y:64,scale:1,rotation:0,opacity:85}] },
  { id: 3, name: "Shape lingkaran", type: "shape", x: 50, y: 50, scale: 1.4, rotation: 0, opacity: 35, color: "#d9b46a", start: 0, end: 8, visible: true, locked: false, keyframes: [{t:0,x:50,y:50,scale:1.4,rotation:0,opacity:35}] }
];

export default function Editor({ project, onBack }) {
  const [ratio, setRatio] = useState(project?.ratio || "9:16");
  const [duration, setDuration] = useState(Number(project?.duration) || 15);
  const [layers, setLayers] = useState(initialLayers);
  const [selected, setSelected] = useState(1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState("design");
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState("Memuat proyek...");
  const [audioWaveforms, setAudioWaveforms] = useState({});
  const [rendering, setRendering] = useState(false);
  const [renderState, setRenderState] = useState("Export");
  const [renderUrl, setRenderUrl] = useState("");
  const historyRef = useRef({ past: [], future: [] });
  const lastLayersRef = useRef(null);
  const skipHistoryRef = useRef(false);
  const [, refreshHistory] = useState(0);

  useEffect(() => {
    const snapshot = JSON.stringify(layers);
    if (lastLayersRef.current === null) {
      lastLayersRef.current = snapshot;
      return;
    }
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      lastLayersRef.current = snapshot;
      return;
    }
    if (lastLayersRef.current !== snapshot) {
      historyRef.current.past.push(lastLayersRef.current);
      if (historyRef.current.past.length > 60) historyRef.current.past.shift();
      historyRef.current.future = [];
      lastLayersRef.current = snapshot;
      refreshHistory(value => value + 1);
    }
  }, [layers]);

  const undo = () => {
    const history = historyRef.current;
    if (!history.past.length) return;
    history.future.push(JSON.stringify(layers));
    const previous = history.past.pop();
    skipHistoryRef.current = true;
    lastLayersRef.current = previous;
    setLayers(JSON.parse(previous));
    refreshHistory(value => value + 1);
  };

  const redo = () => {
    const history = historyRef.current;
    if (!history.future.length) return;
    history.past.push(JSON.stringify(layers));
    const next = history.future.pop();
    skipHistoryRef.current = true;
    lastLayersRef.current = next;
    setLayers(JSON.parse(next));
    refreshHistory(value => value + 1);
  };

  useEffect(() => {
    const handleEditorShortcuts = (event) => {
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = target?.isContentEditable || ["input", "textarea", "select"].includes(tag);
      if (isTyping) return;

      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.code === "Space" && !modifier && !event.altKey) {
        if (["button", "a"].includes(tag)) return;
        event.preventDefault();
        setPlaying(value => !value);
      }
    };
    window.addEventListener("keydown", handleEditorShortcuts);
    return () => window.removeEventListener("keydown", handleEditorShortcuts);
  }, [layers, playing]);

  const timelineRef = useRef(null);
  const objectRefs = useRef({});
  const dragRef = useRef(null);
  const clipDragRef = useRef(null);
  const uploadInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioRefs = useRef({});
  const active = layers.find(l => l.id === selected) || layers[0];

  useEffect(() => {
    let cancelled = false;
    async function loadProject() {
      if (!project?.id) { setHydrated(true); setSaveState("Proyek belum dipilih"); return; }
      setHydrated(false);
      setSaveState("Memuat proyek...");
      try {
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const [projectResponse, assetsResponse] = await Promise.all([
          fetch(`${apiBase}/api/projects/${project.id}`),
          fetch(`${apiBase}/api/projects/${project.id}/assets`)
        ]);
        const projectResult = await projectResponse.json().catch(() => ({}));
        const assetsResult = await assetsResponse.json().catch(() => ({}));
        if (!projectResponse.ok) throw new Error(projectResult.error || "Gagal memuat proyek");
        const saved = projectResult.data?.timeline || {};
        let restored = Array.isArray(saved.layers) && saved.layers.length ? saved.layers : initialLayers;
        const knownAssets = new Set(restored.map(layer => layer.assetId).filter(Boolean));
        const nextId = Math.max(0, ...restored.map(layer => Number(layer.id) || 0)) + 1;
        const storedAssets = Array.isArray(assetsResult.data) ? assetsResult.data : [];
        const recoveredAssets = storedAssets
          .filter(asset => ["image","audio"].includes(asset.asset_type) && !knownAssets.has(asset.id))
          .map((asset, index) => ({
            id: nextId + index, name: asset.file_name || "Gambar",
            type: asset.asset_type, text: "", imageSrc: asset.asset_type === "image" ? asset.file_url : undefined, audioSrc: asset.asset_type === "audio" ? asset.file_url : undefined, assetId: asset.id,
            x: 50, y: 50, scale: 1, rotation: 0, opacity: 100,
            color: "#ffffff", start: 0, end: Number(saved.duration || projectResult.data.duration || 15),
            visible: true, locked: false, ease: "power2.inOut",
            keyframes: [{ t: 0, x: 50, y: 50, scale: 1, rotation: 0, opacity: 100 }]
          }));
        restored = [...restored, ...recoveredAssets];
        if (cancelled) return;
        setLayers(restored);
        setRatio(saved.ratio || projectResult.data.ratio || "9:16");
        setDuration(Number(saved.duration || projectResult.data.duration) || 15);
        setSelected(restored[0]?.id ?? null);
        setTime(0);
        setSaveState("Proyek dimuat");
      } catch (error) {
        if (!cancelled) setSaveState("Gagal memuat: " + error.message);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    loadProject();
    return () => { cancelled = true; };
  }, [project?.id]);

  useEffect(() => {
    let cancelled = false;
    const audioLayers = layers.filter(layer => layer.type === "audio" && layer.audioSrc);
    audioLayers.forEach(async layer => {
      if (audioWaveforms[layer.id]) return;
      try {
        const response = await fetch(layer.audioSrc);
        if (!response.ok) throw new Error("Audio tidak dapat dibaca");
        const buffer = await response.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const decoded = await context.decodeAudioData(buffer.slice(0));
        const channel = decoded.getChannelData(0);
        const bars = 48;
        const samplesPerBar = Math.max(1, Math.floor(channel.length / bars));
        const peaks = Array.from({ length: bars }, (_, index) => {
          const from = index * samplesPerBar;
          const to = Math.min(channel.length, from + samplesPerBar);
          let peak = 0;
          for (let i = from; i < to; i += 1) peak = Math.max(peak, Math.abs(channel[i]));
          return Math.max(10, Math.round(peak * 100));
        });
        await context.close();
        if (!cancelled) setAudioWaveforms(old => ({ ...old, [layer.id]: peaks }));
      } catch (error) {
        console.warn("Waveform audio:", error);
      }
    });
    return () => { cancelled = true; };
  }, [layers]);
  useEffect(() => {
    if (!hydrated || !project?.id) return;
    setSaveState("Ada perubahan...");
    const timer = window.setTimeout(async () => {
      try {
        setSaveState("Menyimpan...");
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiBase}/api/projects/${project.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ratio, duration, timeline: { layers, ratio, duration } })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Autosave gagal");
        setSaveState("Tersimpan");
      } catch (error) {
        setSaveState("Gagal menyimpan");
        console.error("Bang Motion autosave:", error);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [layers, ratio, duration, hydrated, project?.id]);
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      window.alert("Pilih gambar JPG, PNG, WEBP, atau GIF.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      window.alert("Ukuran gambar maksimal 4 MB untuk upload cloud.");
      return;
    }
    if (!project?.id) {
      window.alert("Simpan proyek terlebih dahulu sebelum upload gambar.");
      return;
    }
    setUploading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiBase}/api/projects/${project.id}/assets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-File-Type": file.type
        },
        body: file
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Upload gambar gagal.");
      const asset = result.data;
      const id = Math.max(0, ...layers.map(layer => layer.id)) + 1;
      const item = {
        id, name: file.name.replace(/\.[^.]+$/, "") || "Gambar",
        type: "image", text: "", imageSrc: asset.file_url, assetId: asset.id,
        x: 50, y: 50, scale: 1, rotation: 0, opacity: 100,
        color: "#ffffff", start: time, end: duration,
        visible: true, locked: false, ease: "power2.inOut",
        keyframes: [{ t: time, x: 50, y: 50, scale: 1, rotation: 0, opacity: 100 }]
      };
      setLayers(old => [...old, item]);
      setSelected(id);
      setTab("design");
      window.alert("Gambar berhasil disimpan ke cloud proyek.");
    } catch (error) {
      window.alert(error.message || "Upload gambar gagal.");
    } finally {
      setUploading(false);
    }
  };
  const handleAudioUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const allowed = ["audio/mpeg","audio/mp3","audio/wav","audio/x-wav","audio/ogg","audio/mp4","audio/aac"];
    if (!allowed.includes(file.type)) { window.alert("Pilih audio MP3, WAV, OGG, M4A, atau AAC."); return; }
    if (file.size > 4 * 1024 * 1024) { window.alert("Ukuran audio maksimal 4 MB."); return; }
    if (!project?.id) { window.alert("Simpan proyek terlebih dahulu sebelum upload audio."); return; }
    setUploading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiBase}/api/projects/${project.id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-File-Type": file.type },
        body: file
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Upload audio gagal.");
      const asset = result.data;
      const id = Math.max(0, ...layers.map(layer => Number(layer.id) || 0)) + 1;
      const item = {
        id, name: file.name.replace(/\\.[^.]+$/, "") || "Audio",
        type: "audio", audioSrc: asset.file_url, assetId: asset.id,
        x: 50, y: 50, scale: 1, rotation: 0, opacity: 100, color: "#d9b46a",
        start: time, end: duration, volume: 80, visible: true, locked: false,
        keyframes: [{ t: time, x: 50, y: 50, scale: 1, rotation: 0, opacity: 100 }]
      };
      setLayers(old => [...old, item]); setSelected(id); setTab("design");
      window.alert("Audio berhasil disimpan ke cloud proyek.");
    } catch (error) { window.alert(error.message || "Upload audio gagal."); }
    finally { setUploading(false); }
  };
  const handleObjectPointerDown = (event, layer) => {
    setSelected(layer.id);
    if (layer.locked || playing || layer.type === "audio") return;
    const canvas = event.currentTarget.parentElement;
    const rect = canvas.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineRef.current?.pause();
    setPlaying(false);
    dragRef.current = { id: layer.id, rect, node: event.currentTarget, x: layer.x, y: layer.y, pointerId: event.pointerId };
    event.preventDefault();
  };
  const handleObjectPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - drag.rect.left) / drag.rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - drag.rect.top) / drag.rect.height) * 100));
    drag.x = Number(x.toFixed(1));
    drag.y = Number(y.toFixed(1));
    drag.node.style.left = drag.x + "%";
    drag.node.style.top = drag.y + "%";
  };
  const finishObjectDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setLayers(old => old.map(layer => {
      if (layer.id !== drag.id) return layer;
      const snapshot = { t: Number(time.toFixed(2)), x: drag.x, y: drag.y, scale: layer.scale, rotation: layer.rotation, opacity: layer.opacity };
      const frames = layer.keyframes || [];
      const exists = frames.some(frame => Math.abs(frame.t - time) < 0.05);
      const keyframes = exists
        ? frames.map(frame => Math.abs(frame.t - time) < 0.05 ? snapshot : frame)
        : [...frames, snapshot].sort((a,b) => a.t-b.t);
      return { ...layer, x: drag.x, y: drag.y, keyframes };
    }));
    dragRef.current = null;
  };
  const handleExport = async () => {
    if (rendering) return;
    setRendering(true);
    setRenderState("Menyiapkan...");
    let audioElements = [];
    let audioStreams = [];
    let animationFrame = 0;
    let recorder = null;
    try {
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
        throw new Error("Browser ini belum mendukung ekspor video lokal. Coba Chrome versi terbaru.");
      }
      const dimensions = ratio === "16:9" ? [1280,720] : ratio === "1:1" ? [1080,1080] : [720,1280];
      const [width,height] = dimensions;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak dapat dibuat.");
      const imageCache = new Map();
      const visibleLayers = layers.filter(layer => layer.visible && layer.type !== "audio");
      await Promise.all(visibleLayers.filter(layer => layer.type === "image" && layer.imageSrc).map(layer => new Promise((resolve,reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { imageCache.set(layer.id,img); resolve(); };
        img.onerror = () => reject(new Error("Gagal memuat gambar: " + (layer.name || "gambar") + ". Periksa akses file cloud."));
        img.src = layer.imageSrc;
      })));
      const audioLayers = layers.filter(layer => layer.visible && layer.type === "audio" && layer.audioSrc);
      const audioTracks = [];
      for (const layer of audioLayers) {
        const audio = new Audio(layer.audioSrc);
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        audio.volume = Math.max(0,Math.min(1,Number(layer.volume ?? 80)/100));
        audioElements.push({audio,layer});
        await new Promise(resolve => {
          if (audio.readyState >= 1) resolve();
          else { audio.addEventListener("loadedmetadata",resolve,{once:true}); audio.addEventListener("error",resolve,{once:true}); }
        });
        if (typeof audio.captureStream === "function") {
          const stream = audio.captureStream();
          audioStreams.push(stream);
          stream.getAudioTracks().forEach(track => audioTracks.push(track));
        }
      }
      const stream = canvas.captureStream(30);
      audioTracks.forEach(track => stream.addTrack(track));
      const mimeType = ["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Browser tidak menyediakan encoder WebM yang didukung.");
      const chunks = [];
      recorder = new MediaRecorder(stream,{mimeType,videoBitsPerSecond:5000000});
      const stopped = new Promise((resolve,reject) => {
        recorder.ondataavailable = event => { if(event.data?.size) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error("Perekaman video gagal."));
        recorder.onstop = resolve;
      });
      const easeValue = (value,ease) => {
        const t = Math.max(0,Math.min(1,value));
        if (ease === "power2.in") return t*t;
        if (ease === "power2.out") return 1-(1-t)*(1-t);
        if (ease === "power2.inOut") return t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
        return t;
      };
      const stateAt = (layer,t) => {
        const frames = [...(layer.keyframes || [])].sort((a,b)=>a.t-b.t);
        if (!frames.length) return layer;
        if (t <= frames[0].t) return frames[0];
        if (t >= frames[frames.length-1].t) return frames[frames.length-1];
        const index = frames.findIndex((frame,i)=>i<frames.length-1 && t>=frame.t && t<=frames[i+1].t);
        const a=frames[index], b=frames[index+1];
        const p=easeValue((t-a.t)/Math.max(.001,b.t-a.t),layer.ease);
        return Object.fromEntries(["x","y","scale","rotation","opacity"].map(key=>[key,(Number(a[key] ?? layer[key] ?? 0)*(1-p))+(Number(b[key] ?? layer[key] ?? 0)*p)]));
      };
      const drawFrame = (t) => {
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle="#11131a"; ctx.fillRect(0,0,width,height);
        visibleLayers.forEach(layer => {
          const begin=Number(layer.start||0), finish=Number(layer.end??duration);
          if(t<begin || t>finish) return;
          const state=stateAt(layer,t);
          const x=Number(state.x??layer.x??50)/100*width;
          const y=Number(state.y??layer.y??50)/100*height;
          const scale=Number(state.scale??layer.scale??1);
          ctx.save();
          ctx.translate(x,y);
          ctx.rotate(Number(state.rotation??layer.rotation??0)*Math.PI/180);
          ctx.globalAlpha=Math.max(0,Math.min(1,Number(state.opacity??layer.opacity??100)/100));
          if(layer.type==="text") {
            const fontSize=Math.max(18,Math.round(width*.075*scale));
            ctx.font="700 "+fontSize+"px Arial, sans-serif";
            ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.fillStyle=layer.color||"#ffffff";
            ctx.shadowColor="rgba(0,0,0,.35)"; ctx.shadowBlur=8;
            ctx.fillText(String(layer.text||"Teks baru"),0,0,width*.85);
          } else if(layer.type==="shape") {
            const radius=Math.max(20,width*.12*scale);
            ctx.fillStyle=layer.color||"#d9b46a";
            ctx.beginPath(); ctx.arc(0,0,radius,0,Math.PI*2); ctx.fill();
          } else if(layer.type==="image") {
            const img=imageCache.get(layer.id);
            if(img) {
              const maxW=width*.72*scale, maxH=height*.72*scale;
              const factor=Math.min(maxW/img.width,maxH/img.height);
              const w=img.width*factor,h=img.height*factor;
              ctx.drawImage(img,-w/2,-h/2,w,h);
            }
          }
          ctx.restore();
        });
      };
      setRenderState("Merekam 0%");
      recorder.start(250);
      audioElements.forEach(({audio,layer}) => {
        const offset=Math.max(0,Number(layer.start||0));
        try { audio.currentTime=0; } catch {}
        if(offset===0) audio.play().catch(()=>{});
      });
      const started=performance.now();
      await new Promise((resolve,reject) => {
        const tick=now => {
          const elapsed=(now-started)/1000;
          const current=Math.min(duration,elapsed);
          drawFrame(current);
          audioElements.forEach(({audio,layer}) => {
            const begin=Number(layer.start||0), finish=Number(layer.end??duration);
            if(current>=begin && current<finish) {
              const offset=current-begin;
              if(Math.abs(audio.currentTime-offset)>.35) { try { audio.currentTime=offset; } catch {} }
              const length=finish-begin, fadeIn=Number(layer.fadeIn||0), fadeOut=Number(layer.fadeOut||0);
              let volume=Math.max(0,Math.min(1,Number(layer.volume??80)/100));
              if(fadeIn>0) volume*=Math.min(1,offset/fadeIn);
              if(fadeOut>0) volume*=Math.min(1,(finish-current)/fadeOut);
              audio.volume=volume;
              if(audio.paused) audio.play().catch(()=>{});
            } else if(!audio.paused) audio.pause();
          });
          setRenderState("Merekam "+Math.min(100,Math.round(current/duration*100))+"%");
          if(elapsed>=duration) resolve();
          else animationFrame=requestAnimationFrame(tick);
        };
        animationFrame=requestAnimationFrame(tick);
      });
      audioElements.forEach(({audio})=>audio.pause());
      recorder.stop();
      await stopped;
      const blob=new Blob(chunks,{type:mimeType});
      if(!blob.size) throw new Error("Hasil rekaman kosong.");
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;
      link.download=(project?.title||"bang-motion-video").replace(/[^a-z0-9-_]/gi,"_")+".webm";
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      setRenderState("Export WebM");
      window.alert("Video berhasil diekspor dalam format WebM. Simpan file dari browser.");
    } catch(error) {
      if(recorder && recorder.state!=="inactive") { try { recorder.stop(); } catch {} }
      window.alert(error.message || "Ekspor lokal gagal.");
      setRenderState("Export");
    } finally {
      cancelAnimationFrame(animationFrame);
      audioElements.forEach(({audio})=>{audio.pause();audio.src="";});
      audioStreams.forEach(stream=>stream.getTracks().forEach(track=>track.stop()));
      setRendering(false);
    }
  };
  const seekTime = (value) => {
    const next = Math.max(0, Math.min(duration, Number(value) || 0));
    setPlaying(false);
    timelineRef.current?.pause();
    setTime(next);
    if (timelineRef.current) timelineRef.current.time(next, false);
  };
  const seekFromTrack = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekTime(fraction * duration);
  };
  const startClipDrag = (event, layer) => {
    event.stopPropagation();
    event.preventDefault();
    const edge = event.target?.dataset?.edge || "move";
    const line = event.currentTarget.parentElement;
    const rect = line.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    clipDragRef.current = {
      id: layer.id, edge, pointerId: event.pointerId, startX: event.clientX,
      width: rect.width, originalStart: Number(layer.start || 0),
      originalEnd: Number(layer.end ?? duration)
    };
    setSelected(layer.id);
  };
  const moveClipDrag = (event) => {
    const drag = clipDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = (event.clientX - drag.startX) / Math.max(1, drag.width) * duration;
    const minLength = 0.2;
    let start = drag.originalStart;
    let end = drag.originalEnd;
    if (drag.edge === "left") start = Math.max(0, Math.min(drag.originalEnd - minLength, drag.originalStart + delta));
    else if (drag.edge === "right") end = Math.max(drag.originalStart + minLength, Math.min(duration, drag.originalEnd + delta));
    else {
      const length = drag.originalEnd - drag.originalStart;
      start = Math.max(0, Math.min(duration - length, drag.originalStart + delta));
      end = start + length;
    }
    start = Number(start.toFixed(2));
    end = Number(end.toFixed(2));
    setLayers(old => old.map(layer => layer.id === drag.id ? { ...layer, start, end } : layer));
  };
  const finishClipDrag = (event) => {
    if (!clipDragRef.current || clipDragRef.current.pointerId !== event.pointerId) return;
    clipDragRef.current = null;
  };
  const update = (patch) => setLayers(old => old.map(l => l.id === selected ? { ...l, ...patch } : l));
  const duplicateActive = () => {
    if (!active) return;
    const id = Math.max(0, ...layers.map(layer => Number(layer.id) || 0)) + 1;
    const copy = {
      ...JSON.parse(JSON.stringify(active)),
      id,
      name: (active.name || "Layer") + " copy",
      x: Math.min(95, Number(active.x || 50) + 4),
      y: Math.min(95, Number(active.y || 50) + 4),
      keyframes: (active.keyframes || []).map(frame => ({
        ...frame,
        x: Math.min(95, Number(frame.x ?? active.x ?? 50) + 4),
        y: Math.min(95, Number(frame.y ?? active.y ?? 50) + 4)
      }))
    };
    setLayers(old => [...old, copy]);
    setSelected(id);
    setTab("design");
  };
  const addLayer = (type) => {
    const id = Math.max(0, ...layers.map(l => l.id)) + 1;
    const item = { id, name: type === "text" ? "Teks baru" : type === "shape" ? "Shape baru" : type === "image" ? "Media gambar" : "Audio baru", type, text: "TULIS SESUATU", x: 50, y: 50, scale: 1, rotation: 0, opacity: 100, color: "#f4d28d", start: time, end: duration, visible: true, locked: false, ease:"power2.inOut", keyframes: [{t:time,x:50,y:50,scale:1,rotation:0,opacity:100}] };
    setLayers(old => [...old, item]); setSelected(id);
  };
  const setKeyframe = () => {
    const frames = active.keyframes || [];
    const snapshot = { t: Number(time.toFixed(2)), x: active.x, y: active.y, scale: active.scale, rotation: active.rotation, opacity: active.opacity };
    const exists = frames.some(k => Math.abs(k.t - time) < 0.05);
    const next = exists
      ? frames.map(k => Math.abs(k.t - time) < 0.05 ? snapshot : k)
      : [...frames, snapshot];
    update({ keyframes: next.sort((a,b) => a.t-b.t) });
  };
  const removeKeyframe = () => {
    update({ keyframes: (active.keyframes || []).filter(k => Math.abs(k.t - time) >= 0.05) });
  };
  const previewLayers = useMemo(
    () => layers.filter(l => l.visible && time >= Number(l.start || 0) && time <= Number(l.end ?? duration)),
    [layers, time, duration]
  );
  const updateLayerTiming = (field, value) => {
    if (!active) return;
    const next = Math.max(0, Math.min(duration, Number(value) || 0));
    if (field === "start") update({ start: Math.min(next, Math.max(0, Number(active.end ?? duration) - 0.1)) });
    else update({ end: Math.max(Math.min(duration, Number(active.start || 0) + 0.1), next) });
  };
  useEffect(() => {
    const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
    layers.forEach(layer => {
      const node = objectRefs.current[layer.id];
      if (!node || !layer.visible || layer.type === "audio") return;
      const frames = [...(layer.keyframes || [])].sort((a,b) => a.t-b.t);
      if (!frames.length) return;
      const first = frames[0];
      tl.set(node, { left: first.x+"%", top: first.y+"%", scale: first.scale, rotation: first.rotation, autoAlpha: first.opacity/100 }, first.t);
      frames.slice(1).forEach((frame, index) => {
        const previous = frames[index];
        tl.to(node, { left: frame.x+"%", top: frame.y+"%", scale: frame.scale, rotation: frame.rotation, autoAlpha: frame.opacity/100, duration: Math.max(0.05, frame.t-previous.t), ease: layer.ease || "power2.inOut" }, previous.t);
      });
    });
    timelineRef.current?.kill();
    tl.to({}, { duration: duration }, 0);
    timelineRef.current = tl;
    tl.eventCallback("onUpdate", () => setTime(Number(tl.time().toFixed(2))));
    tl.time(time, false);
    return () => tl.kill();
  }, [layers, duration]);
  useEffect(() => {
    if (timelineRef.current && !playing) timelineRef.current.time(time, false);
  }, [time, playing]);
  useEffect(() => {
    const tl = timelineRef.current;
    if (tl) playing ? tl.play() : tl.pause();
  }, [playing, layers]);
  useEffect(() => {
    layers.filter(layer => layer.type === "audio").forEach(layer => {
      const audio = audioRefs.current[layer.id];
      if (!audio) return;
      const start = Number(layer.start || 0);
      const end = Number(layer.end ?? duration);
      const inRange = time >= start && time < end;
      const baseVolume = Math.max(0, Math.min(1, Number(layer.volume ?? 80) / 100));
      const fadeIn = Math.max(0, Number(layer.fadeIn ?? 0));
      const fadeOut = Math.max(0, Number(layer.fadeOut ?? 0));
      const elapsed = Math.max(0, time - start);
      const remaining = Math.max(0, end - time);
      const fadeInGain = fadeIn > 0 ? Math.min(1, elapsed / fadeIn) : 1;
      const fadeOutGain = fadeOut > 0 ? Math.min(1, remaining / fadeOut) : 1;
      audio.volume = Math.max(0, Math.min(1, baseVolume * Math.min(fadeInGain, fadeOutGain)));
      if (playing && inRange) {
        const offset = Math.max(0, time - start);
        if (Math.abs((audio.currentTime || 0) - offset) > 0.45 && audio.readyState >= 1) {
          try { audio.currentTime = offset; } catch {}
        }
        if (audio.paused) audio.play().catch(error => console.warn("Audio playback:", error));
      } else {
        if (!audio.paused) audio.pause();
        if (!playing && audio.readyState >= 1) {
          const offset = Math.max(0, time - start);
          if (Math.abs((audio.currentTime || 0) - offset) > 0.15) {
            try { audio.currentTime = offset; } catch {}
          }
        }
      }
    });
  }, [time, playing, layers, duration]);
  const canvasRatio = ratio === "9:16" ? "portrait" : ratio === "16:9" ? "landscape" : "square";
  return <section className="pro-editor">
    <div className="pro-top"><button className="pro-back" onClick={onBack}><ArrowLeft size={17}/> Kembali</button><div className="pro-project"><b>{project?.title || "Motion Project"}</b><small>EDITOR PROFESIONAL · {saveState}</small></div><div className="pro-history-actions"><button onClick={undo} disabled={!historyRef.current.past.length} title="Undo"><Undo2 size={16}/></button><button onClick={redo} disabled={!historyRef.current.future.length} title="Redo"><Redo2 size={16}/></button></div><button className="pro-export" disabled={rendering} onClick={handleExport}><Download size={15}/> {renderState}</button></div>
    <div className="pro-workspace">
      <aside className="pro-tools"><button onClick={()=>addLayer("text")}><Type/><span>Teks</span></button><button onClick={()=>addLayer("shape")}><Square/><span>Shape</span></button><button disabled={uploading} onClick={()=>uploadInputRef.current?.click()}><Image/><span>{uploading?"Upload...":"Upload"}</span></button><input ref={uploadInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleImageUpload}/><button disabled={uploading} onClick={()=>audioInputRef.current?.click()}><Music2/><span>{uploading?"Upload...":"Audio"}</span></button><input ref={audioInputRef} type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac" hidden onChange={handleAudioUpload}/></aside>
      <div className="pro-stage">
        <div className="pro-stage-head"><span>CANVAS / LIVE PREVIEW</span><div className="pro-ratios">{[["9:16",Smartphone],["16:9",RectangleHorizontal],["1:1",Circle]].map(([r,I])=><button key={r} className={ratio===r?"chosen":""} onClick={()=>setRatio(r)}><I size={13}/>{r}</button>)}</div></div>
        <div className="pro-canvas-wrap"><div className={"pro-canvas "+canvasRatio}><div className="pro-canvas-glow"/>{layers.filter(layer=>layer.type==="audio"&&layer.audioSrc).map(layer=><audio key={layer.id} ref={node=>{audioRefs.current[layer.id]=node}} src={layer.audioSrc} preload="auto"/>) }{previewLayers.map(l=><div key={l.id} onPointerDown={e=>handleObjectPointerDown(e,l)} onPointerMove={handleObjectPointerMove} onPointerUp={finishObjectDrag} onPointerCancel={finishObjectDrag} onClick={()=>setSelected(l.id)} className={"pro-object "+(selected===l.id?"picked":"")+(l.locked?" locked":"")} ref={node=>{objectRefs.current[l.id]=node}} style={{left:l.x+"%",top:l.y+"%",transform:"translate(-50%,-50%)",opacity:1,color:l.color,borderColor:l.color}}>{l.type==="text"?<span>{l.text || "Teks baru"}</span>:l.type==="shape"?<i/>:l.type==="image"?<img className="pro-image-content" src={l.imageSrc} alt={l.name} draggable="false"/>:<span>♫ AUDIO</span>}</div>)}</div></div>
        <div className="pro-playbar"><button onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><span>{time.toFixed(1)}s / {duration}s</span><input className="pro-time-scrubber" type="range" min="0" max={duration} step=".1" value={Math.min(time,duration)} onInput={e=>seekTime(e.currentTarget.value)} onChange={e=>seekTime(e.currentTarget.value)} aria-label="Geser waktu video"/><span>{ratio}</span></div>
      </div>
      <aside className="pro-inspector"><div className="pro-tabs"><button className={tab==="design"?"on":""} onClick={()=>setTab("design")}>Properties</button><button className={tab==="layers"?"on":""} onClick={()=>setTab("layers")}>Layers</button></div>
        {tab==="design" ? <>{active ? <><div className="pro-selected"><b>{active.name}</b><small>{active.type.toUpperCase()} LAYER</small></div><label className="pro-field">Nama layer<input value={active.name || ""} onChange={e=>update({name:e.target.value})}/></label><button className="pro-duplicate" onClick={duplicateActive}><Copy size={14}/> Duplikat layer</button>{active.type==="audio"&&<><label className="pro-field">Volume · {Number(active.volume ?? 80)}%<input type="range" min="0" max="100" value={Number(active.volume ?? 80)} onChange={e=>update({volume:Number(e.target.value)})}/></label><div className="pro-field-grid"><label className="pro-field">Fade in · detik<input type="number" min="0" max={Math.max(0,Number(active.end ?? duration)-Number(active.start || 0))} step=".1" value={Number(active.fadeIn ?? 0)} onChange={e=>update({fadeIn:Math.max(0,Number(e.target.value)||0)})}/></label><label className="pro-field">Fade out · detik<input type="number" min="0" max={Math.max(0,Number(active.end ?? duration)-Number(active.start || 0))} step=".1" value={Number(active.fadeOut ?? 0)} onChange={e=>update({fadeOut:Math.max(0,Number(e.target.value)||0)})}/></label></div><label className="pro-field">Pratinjau audio<audio className="pro-audio-preview" controls preload="none" src={active.audioSrc}/></label></>}{active.type==="text"&&<label className="pro-field">Konten teks<input value={active.text} onChange={e=>update({text:e.target.value})}/></label>}<label className="pro-field">Warna<input type="color" value={active.color} onChange={e=>update({color:e.target.value})}/></label><div className="pro-field-grid"><label className="pro-field">Posisi X<input type="number" value={active.x} onChange={e=>update({x:Number(e.target.value)})}/></label><label className="pro-field">Posisi Y<input type="number" value={active.y} onChange={e=>update({y:Number(e.target.value)})}/></label><label className="pro-field">Skala<input type="number" step=".1" value={active.scale} onChange={e=>update({scale:Number(e.target.value)})}/></label><label className="pro-field">Rotasi<input type="number" value={active.rotation} onChange={e=>update({rotation:Number(e.target.value)})}/></label></div><label className="pro-field">Opacity · {active.opacity}%<input type="range" min="0" max="100" value={active.opacity} onChange={e=>update({opacity:Number(e.target.value)})}/></label><div className="pro-field-grid"><label className="pro-field">Mulai · detik<input type="number" min="0" max={duration} step=".1" value={Number(active.start || 0)} onChange={e=>updateLayerTiming("start",e.target.value)}/></label><label className="pro-field">Selesai · detik<input type="number" min={Number(active.start || 0)+0.1} max={duration} step=".1" value={Number(active.end ?? duration)} onChange={e=>updateLayerTiming("end",e.target.value)}/></label></div><label className="pro-field">Easing<select value={active.ease || "power2.inOut"} onChange={e=>update({ease:e.target.value})}><option value="none">Linear</option><option value="power2.in">Ease In</option><option value="power2.out">Ease Out</option><option value="power2.inOut">Ease In Out</option><option value="back.out(1.7)">Back Out</option></select></label><div className="pro-key-actions"><button className={"pro-key "+(active.keyframes.some(k => Math.abs(k.t-time) < 0.05)?"key-on":"")} onClick={setKeyframe}><Diamond size={15}/> {active.keyframes.some(k => Math.abs(k.t-time) < 0.05)?"Perbarui keyframe":"Simpan keyframe"} · {time.toFixed(1)}s</button>{active.keyframes.some(k => Math.abs(k.t-time) < 0.05)&&<button className="pro-key-remove" onClick={removeKeyframe}><Trash2 size={14}/> Hapus</button>}</div></> : <p>Pilih layer untuk mengedit.</p>}</> : <div className="pro-layer-list">{layers.map(l=><div key={l.id} className={"pro-layer-row "+(selected===l.id?"sel":"")}><button onClick={()=>setSelected(l.id)}><span className="pro-layer-icon">{l.type==="text"?<Type size={14}/>:l.type==="shape"?<Square size={14}/>:l.type==="image"?<Image size={14}/>:<Music2 size={14}/>}</span><span>{l.name}</span></button><button title="Tampilkan/sembunyikan" onClick={()=>setLayers(old=>old.map(x=>x.id===l.id?{...x,visible:!x.visible}:x))}>{l.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button><button title="Kunci/buka" onClick={()=>setLayers(old=>old.map(x=>x.id===l.id?{...x,locked:!x.locked}:x))}>{l.locked?<Lock size={14}/>:<Unlock size={14}/>}</button><button title="Hapus layer" onClick={()=>{setLayers(old=>old.filter(x=>x.id!==l.id));if(selected===l.id)setSelected(layers.find(x=>x.id!==l.id)?.id)}}><Trash2 size={14}/></button></div>)}</div>}
      </aside>
    </div>
    <div className="pro-timeline"><div className="pro-timeline-head"><div><b>TIMELINE</b><small>{layers.length} LAYERS</small></div><label>Durasi <select value={duration} onChange={e=>{setDuration(Number(e.target.value));setTime(Math.min(time,Number(e.target.value)))}}>{[10,15,20,30,60].map(n=><option key={n}>{n}</option>)}</select> detik</label><button onClick={()=>addLayer("text")}><Plus size={14}/> Layer</button></div><div className="pro-ruler"><span>0s</span>{Array.from({length:Math.max(2,Math.ceil(duration/5))},(_,i)=><span key={i}>{Math.min(duration,(i+1)*5)}s</span>)}</div>{layers.map(l=><div className="pro-track" key={l.id}><button onClick={()=>setSelected(l.id)}>{l.name}</button><div className="pro-track-line" onPointerDown={seekFromTrack}><div className="pro-playhead-line" style={{left:(time/duration*100)+"%"}}/><button className="pro-clip" style={{left:(l.start/duration*100)+"%",width:((l.end-l.start)/duration*100)+"%"}} onPointerDown={e=>startClipDrag(e,l)} onPointerMove={moveClipDrag} onPointerUp={finishClipDrag} onPointerCancel={finishClipDrag} onClick={e=>{e.stopPropagation();setSelected(l.id)}} title="Geser clip; tarik tepi kiri/kanan untuk mengubah durasi"><span className="pro-clip-handle left" data-edge="left"/><span className="pro-clip-label">{l.type==="audio" ? "♫ AUDIO" : l.type.toUpperCase()}</span>{l.type==="audio"&&<span className="pro-waveform" aria-label="Waveform audio">{(audioWaveforms[l.id] || Array.from({length:48},(_,i)=>18+Math.abs(Math.sin(i*1.7))*25)).map((height,i)=><i key={i} style={{height:height+"%"}}/>)}</span>}<span className="pro-clip-handle right" data-edge="right"/></button>{l.keyframes.map(k=><button key={k.t} className="pro-diamond" style={{left:(k.t/duration*100)+"%"}} onClick={e=>{e.stopPropagation();seekTime(k.t)}} title={"Keyframe "+k.t+"s"}/>)}</div></div>)}<div className="pro-timeline-foot">Geser playhead untuk memilih waktu · Ketuk berlian untuk menuju keyframe</div></div>
  </section>;
}
