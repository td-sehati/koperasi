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

## 3) Deploy permanen (Railway + Supabase)

Gunakan Railway untuk app (backend `Express` + frontend build), dan Supabase sebagai database `Postgres`.

### 3.1 Checklist sebelum deploy

- [ ] Repo sudah di-push ke branch `main` GitHub.
- [ ] Sudah punya URL koneksi dari Supabase `Connect -> Session pooler`.
- [ ] Placeholder `[YOUR-PASSWORD]` pada connection string sudah diganti password DB asli.
- [ ] Connection string berakhir dengan `?sslmode=no-verify`.
- [ ] Region app Railway disamakan dengan region Supabase (contoh: sama-sama Singapore) agar tidak lemot.

Contoh format `DATABASE_URL`:
`postgresql://postgres.<project-ref>:<db-password>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=no-verify`

### 3.2 Langkah deploy di Railway

1. Buat project Railway dari repo GitHub ini.
2. Service settings:
   - Build Command: `npm run build`
   - Start Command: `npm run start`
3. Isi `Variables` (environment `production`):
   - `NODE_ENV=production`
   - `PORT=8080`
   - `DATABASE_URL=<connection-string-supabase-session-pooler>?sslmode=no-verify`
   - `ADMIN_USERNAME=owner`
   - `ADMIN_PASSWORD=<ganti-password-kuat>`
   - `SUBSCRIPTION_FEE_LABEL=Rp 90.000 / 30 hari`
   - `SUBSCRIPTION_PAY_TO=Transfer ke rekening owner aplikasi`
   - `SUBSCRIPTION_CONFIRM_TO=Konfirmasi via WhatsApp ke owner aplikasi`
4. Buka `Settings -> Regions & Replicas`, pilih region yang sama dengan Supabase.
5. Redeploy.
6. Generate domain di `Networking` dengan target port `8080`.

Catatan: jika password mengandung karakter khusus (`@`, `:`, `/`, `#`, `%`), lakukan URL-encoding.

### 3.3 Verifikasi setelah deploy

- [ ] Buka URL Railway, aplikasi tampil normal.
- [ ] Login admin berhasil.
- [ ] Tambah anggota berhasil.
- [ ] Tambah tagihan berhasil.
- [ ] Pembayaran tagihan berhasil.
- [ ] Data masuk ke Supabase (Table Editor).

### 3.4 Troubleshooting cepat

- Error `DATABASE_URL belum diisi`:
  - Cek key harus tepat `DATABASE_URL` (huruf besar semua).
  - Pastikan variable diset di environment yang aktif (`production`), lalu redeploy.
- Error `Tenant or user not found`:
  - Biasanya username/password pada connection string salah.
  - Copy ulang dari Supabase `Session pooler`, ganti `[YOUR-PASSWORD]` dengan password DB.
- App online tapi lambat:
  - Samakan region Railway dengan Supabase.

### 3.5 Checklist keamanan setelah live

- [ ] Rotate password DB jika pernah terekspos.
- [ ] Update `DATABASE_URL` di Railway setelah rotate.
- [ ] Ganti `ADMIN_PASSWORD` default.
- [ ] Jangan commit file `.env`.
