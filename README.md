# Koperasi Field Officer App

App transaksi lapangan (anggota, pinjaman, simpanan, cicilan) dengan backend `Express` dan database `Supabase Postgres`.

## 1) Menjalankan lokal

1. Install dependency:
   `npm install`
2. Copy env:
   `copy .env.example .env`
3. Isi `DATABASE_URL` Supabase di `.env`.
4. Jalankan:
   `npm run dev`

## 2) Upload ke GitHub (pertama kali)

1. Inisialisasi git:
   `git init`
2. Tambah file:
   `git add .`
3. Commit awal:
   `git commit -m "Initial commit: koperasi app with supabase"`
4. Buat repo kosong di GitHub (misal: `koperasi-field-officer`).
5. Hubungkan remote:
   `git branch -M main`
   `git remote add origin https://github.com/<username>/koperasi-field-officer.git`
6. Push:
   `git push -u origin main`

Catatan: `.env` tidak ikut ter-push karena sudah diabaikan oleh `.gitignore`.

## 3) Hosting cepat (Render)

Gunakan tipe layanan: `Web Service`.

### Build & start command
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

### Environment Variables (Render)
- `NODE_ENV=production`
- `PORT=10000` (atau biarkan default dari Render)
- `DATABASE_URL=<session-pooler-url-supabase>?sslmode=no-verify`
- `ADMIN_USERNAME=owner`
- `ADMIN_PASSWORD=owner123`
- `SUBSCRIPTION_FEE_LABEL=Rp 90.000 / 30 hari`
- `SUBSCRIPTION_PAY_TO=Transfer ke rekening owner aplikasi`
- `SUBSCRIPTION_CONFIRM_TO=Konfirmasi via WhatsApp ke owner aplikasi`

Setelah deploy selesai, aplikasi akan otomatis membuat schema/table saat server start.

## 4) Verifikasi setelah deploy

1. Buka URL aplikasi dari Render.
2. Login admin.
3. Coba tambah anggota.
4. Pastikan data masuk ke Supabase (Table Editor).
