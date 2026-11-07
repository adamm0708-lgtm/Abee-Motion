import React, { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, Play, Pause, Plus, Type, Square, Image, Music2, Trash2, Copy, Eye, EyeOff, Lock, Unlock, Diamond, Download, Monitor, Smartphone, RectangleHorizontal, Circle } from "lucide-react";

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
  const timelineRef = useRef(null);
  const objectRefs = useRef({});
  const dragRef = useRef(null);
  const clipDragRef = useRef(null);
  const uploadInputRef = useRef(null);
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
          .filter(asset => asset.asset_type === "image" && !knownAssets.has(asset.id))
          .map((asset, index) => ({
            id: nextId + index, name: asset.file_name || "Gambar",
            type: "image", text: "", imageSrc: asset.file_url, assetId: asset.id,
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
  const canvasRatio = ratio === "9:16" ? "portrait" : ratio === "16:9" ? "landscape" : "square";
  return <section className="pro-editor">
    <div className="pro-top"><button className="pro-back" onClick={onBack}><ArrowLeft size={17}/> Kembali</button><div className="pro-project"><b>{project?.title || "Motion Project"}</b><small>EDITOR PROFESIONAL · {saveState}</small></div><button className="pro-export" onClick={()=>alert("Ekspor MP4 cloud akan diaktifkan pada tahap rendering.")}><Download size={15}/> Export</button></div>
    <div className="pro-workspace">
      <aside className="pro-tools"><button onClick={()=>addLayer("text")}><Type/><span>Teks</span></button><button onClick={()=>addLayer("shape")}><Square/><span>Shape</span></button><button disabled={uploading} onClick={()=>uploadInputRef.current?.click()}><Image/><span>{uploading?"Upload...":"Upload"}</span></button><input ref={uploadInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleImageUpload}/><button onClick={()=>addLayer("audio")}><Music2/><span>Audio</span></button></aside>
      <div className="pro-stage">
        <div className="pro-stage-head"><span>CANVAS / LIVE PREVIEW</span><div className="pro-ratios">{[["9:16",Smartphone],["16:9",RectangleHorizontal],["1:1",Circle]].map(([r,I])=><button key={r} className={ratio===r?"chosen":""} onClick={()=>setRatio(r)}><I size={13}/>{r}</button>)}</div></div>
        <div className="pro-canvas-wrap"><div className={"pro-canvas "+canvasRatio}><div className="pro-canvas-glow"/>{previewLayers.map(l=><div key={l.id} onPointerDown={e=>handleObjectPointerDown(e,l)} onPointerMove={handleObjectPointerMove} onPointerUp={finishObjectDrag} onPointerCancel={finishObjectDrag} onClick={()=>setSelected(l.id)} className={"pro-object "+(selected===l.id?"picked":"")+(l.locked?" locked":"")} ref={node=>{objectRefs.current[l.id]=node}} style={{left:l.x+"%",top:l.y+"%",transform:"translate(-50%,-50%)",opacity:1,color:l.color,borderColor:l.color}}>{l.type==="text"?<span>{l.text || "Teks baru"}</span>:l.type==="shape"?<i/>:l.type==="image"?<img className="pro-image-content" src={l.imageSrc} alt={l.name} draggable="false"/>:<span>♫ AUDIO</span>}</div>)}</div></div>
        <div className="pro-playbar"><button onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><span>{time.toFixed(1)}s / {duration}s</span><input className="pro-time-scrubber" type="range" min="0" max={duration} step=".1" value={Math.min(time,duration)} onInput={e=>seekTime(e.currentTarget.value)} onChange={e=>seekTime(e.currentTarget.value)} aria-label="Geser waktu video"/><span>{ratio}</span></div>
      </div>
      <aside className="pro-inspector"><div className="pro-tabs"><button className={tab==="design"?"on":""} onClick={()=>setTab("design")}>Properties</button><button className={tab==="layers"?"on":""} onClick={()=>setTab("layers")}>Layers</button></div>
        {tab==="design" ? <>{active ? <><div className="pro-selected"><b>{active.name}</b><small>{active.type.toUpperCase()} LAYER</small></div><label className="pro-field">Nama layer<input value={active.name || ""} onChange={e=>update({name:e.target.value})}/></label><button className="pro-duplicate" onClick={duplicateActive}><Copy size={14}/> Duplikat layer</button>{active.type==="text"&&<label className="pro-field">Konten teks<input value={active.text} onChange={e=>update({text:e.target.value})}/></label>}<label className="pro-field">Warna<input type="color" value={active.color} onChange={e=>update({color:e.target.value})}/></label><div className="pro-field-grid"><label className="pro-field">Posisi X<input type="number" value={active.x} onChange={e=>update({x:Number(e.target.value)})}/></label><label className="pro-field">Posisi Y<input type="number" value={active.y} onChange={e=>update({y:Number(e.target.value)})}/></label><label className="pro-field">Skala<input type="number" step=".1" value={active.scale} onChange={e=>update({scale:Number(e.target.value)})}/></label><label className="pro-field">Rotasi<input type="number" value={active.rotation} onChange={e=>update({rotation:Number(e.target.value)})}/></label></div><label className="pro-field">Opacity · {active.opacity}%<input type="range" min="0" max="100" value={active.opacity} onChange={e=>update({opacity:Number(e.target.value)})}/></label><div className="pro-field-grid"><label className="pro-field">Mulai · detik<input type="number" min="0" max={duration} step=".1" value={Number(active.start || 0)} onChange={e=>updateLayerTiming("start",e.target.value)}/></label><label className="pro-field">Selesai · detik<input type="number" min={Number(active.start || 0)+0.1} max={duration} step=".1" value={Number(active.end ?? duration)} onChange={e=>updateLayerTiming("end",e.target.value)}/></label></div><label className="pro-field">Easing<select value={active.ease || "power2.inOut"} onChange={e=>update({ease:e.target.value})}><option value="none">Linear</option><option value="power2.in">Ease In</option><option value="power2.out">Ease Out</option><option value="power2.inOut">Ease In Out</option><option value="back.out(1.7)">Back Out</option></select></label><div className="pro-key-actions"><button className={"pro-key "+(active.keyframes.some(k => Math.abs(k.t-time) < 0.05)?"key-on":"")} onClick={setKeyframe}><Diamond size={15}/> {active.keyframes.some(k => Math.abs(k.t-time) < 0.05)?"Perbarui keyframe":"Simpan keyframe"} · {time.toFixed(1)}s</button>{active.keyframes.some(k => Math.abs(k.t-time) < 0.05)&&<button className="pro-key-remove" onClick={removeKeyframe}><Trash2 size={14}/> Hapus</button>}</div></> : <p>Pilih layer untuk mengedit.</p>}</> : <div className="pro-layer-list">{layers.map(l=><div key={l.id} className={"pro-layer-row "+(selected===l.id?"sel":"")}><button onClick={()=>setSelected(l.id)}><span className="pro-layer-icon">{l.type==="text"?<Type size={14}/>:l.type==="shape"?<Square size={14}/>:l.type==="image"?<Image size={14}/>:<Music2 size={14}/>}</span><span>{l.name}</span></button><button title="Tampilkan/sembunyikan" onClick={()=>setLayers(old=>old.map(x=>x.id===l.id?{...x,visible:!x.visible}:x))}>{l.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button><button title="Kunci/buka" onClick={()=>setLayers(old=>old.map(x=>x.id===l.id?{...x,locked:!x.locked}:x))}>{l.locked?<Lock size={14}/>:<Unlock size={14}/>}</button><button title="Hapus layer" onClick={()=>{setLayers(old=>old.filter(x=>x.id!==l.id));if(selected===l.id)setSelected(layers.find(x=>x.id!==l.id)?.id)}}><Trash2 size={14}/></button></div>)}</div>}
      </aside>
    </div>
    <div className="pro-timeline"><div className="pro-timeline-head"><div><b>TIMELINE</b><small>{layers.length} LAYERS</small></div><label>Durasi <select value={duration} onChange={e=>{setDuration(Number(e.target.value));setTime(Math.min(time,Number(e.target.value)))}}>{[10,15,20,30,60].map(n=><option key={n}>{n}</option>)}</select> detik</label><button onClick={()=>addLayer("text")}><Plus size={14}/> Layer</button></div><div className="pro-ruler"><span>0s</span>{Array.from({length:Math.max(2,Math.ceil(duration/5))},(_,i)=><span key={i}>{Math.min(duration,(i+1)*5)}s</span>)}</div>{layers.map(l=><div className="pro-track" key={l.id}><button onClick={()=>setSelected(l.id)}>{l.name}</button><div className="pro-track-line" onPointerDown={seekFromTrack}><div className="pro-playhead-line" style={{left:(time/duration*100)+"%"}}/><button className="pro-clip" style={{left:(l.start/duration*100)+"%",width:((l.end-l.start)/duration*100)+"%"}} onPointerDown={e=>startClipDrag(e,l)} onPointerMove={moveClipDrag} onPointerUp={finishClipDrag} onPointerCancel={finishClipDrag} onClick={e=>{e.stopPropagation();setSelected(l.id)}} title="Geser clip; tarik tepi kiri/kanan untuk mengubah durasi"><span className="pro-clip-handle left" data-edge="left"/><span className="pro-clip-label">{l.type.toUpperCase()}</span><span className="pro-clip-handle right" data-edge="right"/></button>{l.keyframes.map(k=><button key={k.t} className="pro-diamond" style={{left:(k.t/duration*100)+"%"}} onClick={e=>{e.stopPropagation();seekTime(k.t)}} title={"Keyframe "+k.t+"s"}/>)}</div></div>)}<div className="pro-timeline-foot">Geser playhead untuk memilih waktu · Ketuk berlian untuk menuju keyframe</div></div>
  </section>;
}
