import React, { useMemo, useState } from "react";
import { ArrowLeft, Play, Pause, Plus, Type, Square, Image, Music2, Trash2, Copy, Eye, EyeOff, Lock, Unlock, Diamond, Download, Monitor, Smartphone, RectangleHorizontal, Circle } from "lucide-react";

const initialLayers = [
  { id: 1, name: "Judul utama", type: "text", text: "MAKE IT MOVE.", x: 50, y: 48, scale: 1, rotation: 0, opacity: 100, color: "#f4d28d", start: 0, end: 8, visible: true, locked: false, keyframes: [0, 4] },
  { id: 2, name: "Subjudul", type: "text", text: "BANG MOTION STUDIO", x: 50, y: 64, scale: 1, rotation: 0, opacity: 85, color: "#ffffff", start: 1, end: 8, visible: true, locked: false, keyframes: [1] },
  { id: 3, name: "Shape lingkaran", type: "shape", x: 50, y: 50, scale: 1.4, rotation: 0, opacity: 35, color: "#d9b46a", start: 0, end: 8, visible: true, locked: false, keyframes: [0] }
];

export default function Editor({ project, onBack }) {
  const [ratio, setRatio] = useState(project?.ratio || "9:16");
  const [duration, setDuration] = useState(Number(project?.duration) || 15);
  const [layers, setLayers] = useState(initialLayers);
  const [selected, setSelected] = useState(1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState("design");
  const active = layers.find(l => l.id === selected) || layers[0];
  const update = (patch) => setLayers(old => old.map(l => l.id === selected ? { ...l, ...patch } : l));
  const addLayer = (type) => {
    const id = Math.max(0, ...layers.map(l => l.id)) + 1;
    const item = { id, name: type === "text" ? "Teks baru" : type === "shape" ? "Shape baru" : type === "image" ? "Media gambar" : "Audio baru", type, text: "TULIS SESUATU", x: 50, y: 50, scale: 1, rotation: 0, opacity: 100, color: "#f4d28d", start: time, end: duration, visible: true, locked: false, keyframes: [time] };
    setLayers(old => [...old, item]); setSelected(id);
  };
  const toggleKeyframe = () => update({ keyframes: active.keyframes.includes(time) ? active.keyframes.filter(k => k !== time) : [...active.keyframes, time].sort((a,b)=>a-b) });
  const previewLayers = useMemo(() => layers.filter(l => l.visible && time >= l.start && time <= l.end), [layers, time]);
  const canvasRatio = ratio === "9:16" ? "portrait" : ratio === "16:9" ? "landscape" : "square";
  return <section className="pro-editor">
    <div className="pro-top"><button className="pro-back" onClick={onBack}><ArrowLeft size={17}/> Kembali</button><div className="pro-project"><b>{project?.title || "Motion Project"}</b><small>EDITOR PROFESIONAL · AUTO WORKSPACE</small></div><button className="pro-export" onClick={()=>alert("Ekspor MP4 cloud akan diaktifkan pada tahap rendering.")}><Download size={15}/> Export</button></div>
    <div className="pro-workspace">
      <aside className="pro-tools"><button onClick={()=>addLayer("text")}><Type/><span>Teks</span></button><button onClick={()=>addLayer("shape")}><Square/><span>Shape</span></button><button onClick={()=>addLayer("image")}><Image/><span>Gambar</span></button><button onClick={()=>addLayer("audio")}><Music2/><span>Audio</span></button></aside>
      <div className="pro-stage">
        <div className="pro-stage-head"><span>CANVAS / LIVE PREVIEW</span><div className="pro-ratios">{[["9:16",Smartphone],["16:9",RectangleHorizontal],["1:1",Circle]].map(([r,I])=><button key={r} className={ratio===r?"chosen":""} onClick={()=>setRatio(r)}><I size={13}/>{r}</button>)}</div></div>
        <div className="pro-canvas-wrap"><div className={"pro-canvas "+canvasRatio}><div className="pro-canvas-glow"/>{previewLayers.map(l=><div key={l.id} onClick={()=>setSelected(l.id)} className={"pro-object "+(selected===l.id?"picked":"")} style={{left:l.x+"%",top:l.y+"%",transform:"translate(-50%,-50%) rotate("+l.rotation+"deg) scale("+l.scale+")",opacity:l.opacity/100,color:l.color,borderColor:l.color}}>{l.type==="text"?<span>{l.text || "Teks baru"}</span>:l.type==="shape"?<i/>:l.type==="image"?<span>▧ MEDIA</span>:<span>♫ AUDIO</span>}</div>)}</div></div>
        <div className="pro-playbar"><button onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><span>{time.toFixed(1)}s / {duration}s</span><input type="range" min="0" max={duration} step=".1" value={time} onChange={e=>{setTime(Number(e.target.value));setPlaying(false)}}/><span>{ratio}</span></div>
      </div>
      <aside className="pro-inspector"><div className="pro-tabs"><button className={tab==="design"?"on":""} onClick={()=>setTab("design")}>Properties</button><button className={tab==="layers"?"on":""} onClick={()=>setTab("layers")}>Layers</button></div>
        {tab==="design" ? <>{active ? <><div className="pro-selected"><b>{active.name}</b><small>{active.type.toUpperCase()} LAYER</small></div>{active.type==="text"&&<label className="pro-field">Konten teks<input value={active.text} onChange={e=>update({text:e.target.value})}/></label>}<label className="pro-field">Warna<input type="color" value={active.color} onChange={e=>update({color:e.target.value})}/></label><div className="pro-field-grid"><label className="pro-field">Posisi X<input type="number" value={active.x} onChange={e=>update({x:Number(e.target.value)})}/></label><label className="pro-field">Posisi Y<input type="number" value={active.y} onChange={e=>update({y:Number(e.target.value)})}/></label><label className="pro-field">Skala<input type="number" step=".1" value={active.scale} onChange={e=>update({scale:Number(e.target.value)})}/></label><label className="pro-field">Rotasi<input type="number" value={active.rotation} onChange={e=>update({rotation:Number(e.target.value)})}/></label></div><label className="pro-field">Opacity · {active.opacity}%<input type="range" min="0" max="100" value={active.opacity} onChange={e=>update({opacity:Number(e.target.value)})}/></label><button className={"pro-key "+(active.keyframes.includes(time)?"key-on":"")} onClick={toggleKeyframe}><Diamond size={15}/> {active.keyframes.includes(time)?"Hapus keyframe":"Tambah keyframe"} · {time.toFixed(1)}s</button></> : <p>Pilih layer untuk mengedit.</p>}</> : <div className="pro-layer-list">{layers.map(l=><div key={l.id} className={"pro-layer-row "+(selected===l.id?"sel":"")}><button onClick={()=>setSelected(l.id)}><span className="pro-layer-icon">{l.type==="text"?<Type size={14}/>:l.type==="shape"?<Square size={14}/>:l.type==="image"?<Image size={14}/>:<Music2 size={14}/>}</span><span>{l.name}</span></button><button title="Tampilkan/sembunyikan" onClick={()=>setLayers(old=>old.map(x=>x.id===l.id?{...x,visible:!x.visible}:x))}>{l.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button><button title="Kunci/buka" onClick={()=>setLayers(old=>old.map(x=>x.id===l.id?{...x,locked:!x.locked}:x))}>{l.locked?<Lock size={14}/>:<Unlock size={14}/>}</button><button title="Hapus layer" onClick={()=>{setLayers(old=>old.filter(x=>x.id!==l.id));if(selected===l.id)setSelected(layers.find(x=>x.id!==l.id)?.id)}}><Trash2 size={14}/></button></div>)}</div>}
      </aside>
    </div>
    <div className="pro-timeline"><div className="pro-timeline-head"><div><b>TIMELINE</b><small>{layers.length} LAYERS</small></div><label>Durasi <select value={duration} onChange={e=>{setDuration(Number(e.target.value));setTime(Math.min(time,Number(e.target.value)))}}>{[10,15,20,30,60].map(n=><option key={n}>{n}</option>)}</select> detik</label><button onClick={()=>addLayer("text")}><Plus size={14}/> Layer</button></div><div className="pro-ruler"><span>0s</span>{Array.from({length:Math.max(2,Math.ceil(duration/5))},(_,i)=><span key={i}>{Math.min(duration,(i+1)*5)}s</span>)}</div>{layers.map(l=><div className="pro-track" key={l.id}><button onClick={()=>setSelected(l.id)}>{l.name}</button><div className="pro-track-line"><button className="pro-clip" style={{left:(l.start/duration*100)+"%",width:((l.end-l.start)/duration*100)+"%"}} onClick={()=>setSelected(l.id)}>{l.type.toUpperCase()}</button>{l.keyframes.map(k=><button key={k} className="pro-diamond" style={{left:(k/duration*100)+"%"}} onClick={()=>setTime(k)} title={"Keyframe "+k+"s"}/>)}</div></div>)}<div className="pro-timeline-foot">Geser playhead untuk memilih waktu · Ketuk berlian untuk menuju keyframe</div></div>
  </section>;
}
