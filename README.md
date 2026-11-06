# Bang Motion Studio — MVP Tahap 1

PWA pribadi untuk mengelola proyek motion graphics. Tahap 1 mencakup:
- Dashboard responsif untuk Android
- Daftar proyek dan pembuatan proyek
- Galeri template awal
- Editor shell dengan preview placeholder dan panel pengaturan
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

## Catatan tahap 1
Tombol "Buat video dengan AI" dan "Export MP4" masih berupa placeholder UI. Integrasi AI API, GSAP timeline engine, upload aset, dan cloud renderer masuk tahap 2–4.
