# Bang Motion Studio — MVP Tahap 1

PWA pribadi untuk mengelola proyek motion graphics. Tahap 1 mencakup:
- Dashboard responsif untuk Android
- Daftar proyek dan pembuatan proyek
- Galeri template awal
- Editor timeline dengan layer, keyframe, upload aset, autosave, dan preview
- AI Motion Generator melalui Gemini API untuk membuat animasi HTML/CSS/SVG dan menyimpan preview ke proyek
- Backend Express dengan health check dan API proyek/template
- Skema Supabase SQL opsional

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: Supabase PostgreSQL (opsional pada tahap awal; fallback memori untuk demo)
- PWA: manifest + service worker sederhana

## Menjalankan secara lokal
Butuh Node.js 20+.

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Backend berjalan di `http://localhost:4000`.

### 2. Frontend
Buka terminal baru:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev -- --host 0.0.0.0
```
Buka alamat Vite yang tampil. Untuk HP, gunakan alamat LAN komputer dan pastikan keduanya satu jaringan.

## Supabase
1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan `database/schema.sql`.
4. Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di `backend/.env`.
5. Jangan pernah memasukkan service role key ke frontend.

Jika variabel Supabase belum diisi, backend memakai penyimpanan memori sementara. Data demo akan hilang ketika server dimulai ulang.

## AI Motion Generator (Tahap 2 awal)
- Editor menyediakan panel prompt untuk membuat animasi motion graphics melalui Gemini.
- Backend memanggil Gemini API; API key hanya disimpan di environment backend sebagai `GEMINI_API_KEY`.
- Model dapat diatur melalui `GEMINI_MODEL`; default saat ini `gemini-3.8-flash`.
- Hasil HTML animasi disimpan pada timeline proyek dan ditampilkan di preview iframe terisolasi.
- Preview HTML hasil AI saat ini belum menjadi layer timeline dan belum ikut dalam ekspor MP4/WebM. Ekspor yang tersedia masih merender layer editor biasa.

### Environment backend
Set minimal:
- `GEMINI_API_KEY`: API key dari Google AI Studio.
Opsional:
- `GEMINI_MODEL`: nama model Gemini, default `gemini-3.8-flash`.
- `FRONTEND_ORIGIN`: origin frontend untuk CORS.
- `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`: penyimpanan proyek dan aset persisten.

Jangan pernah memasukkan Gemini API key atau Supabase service role key ke variabel frontend berawalan `VITE_`.
