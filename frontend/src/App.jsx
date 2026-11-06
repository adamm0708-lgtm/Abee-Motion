import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Sparkles, Clapperboard, Layers3, FolderOpen, Settings, Play, MoreHorizontal, Film, WandSparkles, Clock3, Smartphone, ArrowUpRight, X, ChevronRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const fallbackTemplates = [
  { id:"cinematic-opener", name:"Cinematic Opener", category:"Cinematic", description:"Opening dramatis dengan judul besar.", duration:10, ratio:"9:16", accent:"#d6a85f" },
  { id:"kinetic-type", name:"Kinetic Typography", category:"Typography", description:"Teks dinamis dengan gerakan cepat.", duration:15, ratio:"9:16", accent:"#8b9cff" },
  { id:"product-promo", name:"Product Promo", category:"Produk", description:"Showcase produk dengan komposisi premium.", duration:20, ratio:"9:16", accent:"#e7b95d" },
  { id:"explainer", name:"Explainer", category:"Edukasi", description:"Penjelasan visual yang rapi dan mudah diikuti.", duration:30, ratio:"16:9", accent:"#62c8a6" },
  { id:"cartoon-motion", name:"Cartoon Motion", category:"Kartun", description:"Gerakan ilustrasi ceria untuk konten edukasi.", duration:20, ratio:"9:16", accent:"#f08d82" }
];

async function api(path, options={}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type":"application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Terjadi kesalahan API");
  return body;
}

function App() {
  const [page, setPage] = useState("home");
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState(fallbackTemplates);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(fallbackTemplates[0]);
  const [title, setTitle] = useState("Proyek Motion Baru");
  const [duration, setDuration] = useState(15);
  const [ratio, setRatio] = useState("9:16");
  const [activeProject, setActiveProject] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };

  async function refresh() {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([api("/api/projects"), api("/api/templates")]);
      setProjects(p.data || []);
      if (t.data?.length) setTemplates(t.data);
    } catch (e) { notify(`API belum terhubung: ${e.message}`); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const filteredProjects = useMemo(() => projects.filter(p => p.title.toLowerCase().includes(query.toLowerCase())), [projects, query]);

  async function createProject() {
    try {
      const result = await api("/api/projects", { method:"POST", body:JSON.stringify({
        title, template_id:selectedTemplate?.id, duration:Number(duration), ratio
      })});
      setProjects(prev => [result.data, ...prev]);
      setActiveProject(result.data);
      setModal(false);
      setPage("editor");
      notify("Proyek berhasil dibuat");
    } catch (e) { notify(e.message); }
  }

  async function deleteProject(id) {
    if (!window.confirm("Hapus proyek ini?")) return;
    try { await api(`/api/projects/${id}`, {method:"DELETE"}); setProjects(prev => prev.filter(p => p.id !== id)); notify("Proyek dihapus"); }
    catch(e) { notify(e.message); }
  }

  const nav = [
    {id:"home", label:"Beranda", icon:Clapperboard},
    {id:"projects", label:"Proyek", icon:FolderOpen},
    {id:"templates", label:"Template", icon:Layers3},
    {id:"settings", label:"Pengaturan", icon:Settings}
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Film size={21}/></div><div><b>BANG MOTION</b><small>STUDIO</small></div></div>
      <div className="side-label">WORKSPACE</div>
      {nav.map(item => <button key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={()=>setPage(item.id)}><item.icon size={18}/>{item.label}</button>)}
      <div className="sidebar-bottom"><div className="status-dot"/> Personal workspace <span>v0.1</span></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="mobile-brand"><div className="brand-mark"><Film size={18}/></div><b>BANG MOTION</b></div>
        <div className="breadcrumb">Workspace <ChevronRight size={14}/> <span>{nav.find(n=>n.id===page)?.label || "Editor"}</span></div>
        <button className="avatar" onClick={()=>setPage("settings")}>BM</button>
      </header>

      {page==="home" && <section className="content">
        <div className="hero">
          <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> YOUR CREATIVE WORKSPACE</div><h1>Ide jadi gerak.<br/><em>Cerita jadi visual.</em></h1><p>Buat motion graphics, video promosi, dan animasi teks dari satu ruang kerja.</p><button className="primary-btn" onClick={()=>setModal(true)}><Plus size={18}/> Buat proyek baru</button></div>
          <div className="hero-art"><div className="orb orb-one"/><div className="orb orb-two"/><div className="art-card"><div className="art-top"><span>01 / MOTION STUDY</span><MoreHorizontal size={16}/></div><div className="art-type">MOVE<br/><i>WITH</i><br/>PURPOSE.</div><div className="art-line"/><div className="art-foot">BANG MOTION STUDIO <span>✳</span></div></div></div>
        </div>
        <div className="section-head"><div><div className="eyebrow muted">YOUR WORK</div><h2>Mulai berkarya</h2></div><button className="text-btn" onClick={()=>setPage("projects")}>Semua proyek <ArrowUpRight size={15}/></button></div>
        <div className="quick-grid">
          <button className="quick-card" onClick={()=>setModal(true)}><div className="quick-icon gold"><Plus/></div><b>Proyek baru</b><span>Mulai dari kanvas kosong</span></button>
          <button className="quick-card" onClick={()=>setPage("templates")}><div className="quick-icon purple"><Layers3/></div><b>Jelajahi template</b><span>Pilih gaya visual siap pakai</span></button>
          <button className="quick-card" onClick={()=>notify("AI Generator tersedia pada tahap 2")}><div className="quick-icon blue"><WandSparkles/></div><b>Generate dengan AI</b><span>Ubah prompt menjadi motion</span><small className="coming">SEGERA HADIR</small></button>
        </div>
        <div className="section-head recent-head"><div><div className="eyebrow muted">RECENT FILES</div><h2>Proyek terakhir</h2></div></div>
        {loading ? <div className="empty">Memuat proyek...</div> : projects.length===0 ? <div className="empty"><div className="empty-icon"><Film size={25}/></div><b>Belum ada proyek</b><span>Proyek pertamamu menunggu untuk dibuat.</span><button className="text-btn" onClick={()=>setModal(true)}>Buat proyek pertama <ArrowUpRight size={15}/></button></div> :
          <div className="project-grid">{projects.slice(0,4).map(p=><ProjectCard key={p.id} project={p} onOpen={()=>{setActiveProject(p);setPage("editor")}} onDelete={()=>deleteProject(p.id)}/>)}</div>}
      </section>}

      {page==="projects" && <section className="content"><div className="page-heading"><div><div className="eyebrow muted">LIBRARY</div><h1>Semua proyek</h1><p>Kelola semua karya motion graphics kamu.</p></div><button className="primary-btn" onClick={()=>setModal(true)}><Plus size={17}/> Proyek baru</button></div><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari proyek..."/></div>{filteredProjects.length ? <div className="project-grid">{filteredProjects.map(p=><ProjectCard key={p.id} project={p} onOpen={()=>{setActiveProject(p);setPage("editor")}} onDelete={()=>deleteProject(p.id)}/>)}</div> : <div className="empty">Tidak ada proyek yang cocok.</div>}</section>}

      {page==="templates" && <section className="content"><div className="page-heading"><div><div className="eyebrow muted">START WITH A STYLE</div><h1>Template motion</h1><p>Pilih fondasi visual untuk proyek berikutnya.</p></div></div><div className="template-grid">{templates.map(t=><TemplateCard key={t.id} template={t} onChoose={()=>{setSelectedTemplate(t);setTitle(t.name+" Baru");setDuration(t.duration);setRatio(t.ratio);setModal(true)}}/>)}</div></section>}

      {page==="editor" && <section className="content editor-page"><div className="editor-toolbar"><div><div className="eyebrow muted">PROJECT EDITOR</div><h1>{activeProject?.title || "Editor baru"}</h1></div><button className="outline-btn" onClick={()=>notify("Cloud rendering akan aktif pada tahap 4")}><Play size={15}/> Export MP4</button></div><div className="editor-layout"><div className="preview-panel"><div className="preview-label"><span>PREVIEW CANVAS</span><span>{activeProject?.ratio || "9:16"} · {activeProject?.duration || 15}s</span></div><div className={`canvas ${activeProject?.ratio==="16:9"?"wide":""}`}><div className="canvas-glow"/><div className="canvas-content"><small>YOUR NEXT STORY</small><strong>MAKE<br/><i>IT</i> MOVE.</strong><div className="canvas-rule"/><span>BANG MOTION STUDIO</span></div></div><div className="preview-controls"><button onClick={()=>notify("Preview engine akan aktif pada tahap 2")}><Play size={16}/></button><span>00:00 / {String(activeProject?.duration || 15).padStart(2,"0")}:00</span><span className="preview-note">Preview contoh</span></div></div><div className="properties"><div className="prop-title">PROPERTIES</div><label>Nama proyek<input value={activeProject?.title || ""} readOnly/></label><label>Durasi<input value={`${activeProject?.duration || 15} detik`} readOnly/></label><label>Rasio<input value={activeProject?.ratio || "9:16"} readOnly/></label><div className="locked-note"><Sparkles size={16}/> Pengaturan layer, teks, dan animasi akan hadir pada tahap editor.</div><button className="primary-btn full" onClick={()=>notify("Editor timeline masuk tahap 3")}>Buka timeline <ChevronRight size={16}/></button></div></div></section>}

      {page==="settings" && <section className="content"><div className="eyebrow muted">PREFERENCES</div><h1>Pengaturan</h1><div className="settings-card"><div><b>Bang Motion Studio</b><p>Personal workspace · MVP 0.1.0</p></div><span className="pill">Tahap 1</span></div><div className="settings-card"><div><b>Koneksi backend</b><p>API: {API}</p></div><button className="outline-btn" onClick={()=>api("/api/health").then(r=>notify(`API aktif · ${r.database}`)).catch(()=>notify("Backend belum aktif"))}>Tes koneksi</button></div><div className="settings-card"><div><b>Penyimpanan</b><p>Supabase jika dikonfigurasi, memori demo sebagai fallback.</p></div></div></section>}
    </main>

    <nav className="mobile-nav">{nav.map(item=><button key={item.id} className={page===item.id?"selected":""} onClick={()=>setPage(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</nav>

    {modal && <div className="modal-backdrop" onClick={()=>setModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow muted">NEW PROJECT</div><h2>Buat proyek baru</h2></div><button className="icon-btn" onClick={()=>setModal(false)}><X/></button></div><label>Nama proyek<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Promo Es Teh Jumbo"/></label><label>Template<select value={selectedTemplate?.id || ""} onChange={e=>setSelectedTemplate(templates.find(t=>t.id===e.target.value))}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><div className="form-row"><label>Durasi<select value={duration} onChange={e=>setDuration(e.target.value)}>{[10,15,20,30,60].map(v=><option key={v} value={v}>{v} detik</option>)}</select></label><label>Rasio<select value={ratio} onChange={e=>setRatio(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option></select></label></div><button className="primary-btn full" onClick={createProject}><Plus size={17}/> Buat proyek</button></div></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function ProjectCard({project,onOpen,onDelete}) {
  return <div className="project-card"><button className="project-thumb" onClick={onOpen}><div className="thumb-stamp">BM / STUDIO</div><div className="thumb-title">{project.title}</div><span>{project.ratio} · {project.duration}s</span></button><div className="project-meta"><button onClick={onOpen}><b>{project.title}</b><small>{new Date(project.created_at).toLocaleDateString("id-ID")} · Draft</small></button><button className="icon-btn" onClick={onDelete}><MoreHorizontal size={18}/></button></div></div>;
}
function TemplateCard({template,onChoose}) {
  return <button className="template-card" onClick={onChoose}><div className="template-art" style={{"--accent":template.accent}}><div className="template-art-label">{template.category.toUpperCase()}</div><div className="template-art-title">{template.id==="kinetic-type"?"TYPE\nIN MOTION":template.id==="product-promo"?"MAKE IT\nDESIRABLE":template.id==="explainer"?"IDEAS\nIN MOTION":template.id==="cartoon-motion"?"PLAY.\nLEARN.\nMOVE.":"MAKE\nAN\nENTRANCE"}</div><div className="template-art-foot">BANG MOTION ✳</div></div><div className="template-info"><div><b>{template.name}</b><span>{template.description}</span></div><ArrowUpRight size={17}/></div></button>;
}
export default App;
