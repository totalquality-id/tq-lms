# Total Quality Learning

Learning Management System untuk PT Total Quality Indonesia. Dibangun dengan Next.js 16, TypeScript, Tailwind CSS, Radix, Auth.js, Prisma, dan PostgreSQL.

Platform ini mendampingi satu siklus pelatihan utuh: undangan, pendaftaran, pre-test, materi, tugas, ujian akhir, evaluasi, sertifikat, dan rekam kompetensi peserta.

## Fitur yang tersedia

**Administrasi pelatihan.** Organisasi klien, pengguna dan peran, course beserta modul dan pelajaran yang dapat diurutkan, training batch dengan jadwal, kapasitas, penugasan trainer, dan pendaftaran peserta.

**Pembelajaran.** Halaman training peserta dengan tab Ringkasan, Materi, Penilaian, Tugas, Materi pendukung, Evaluasi, dan Sertifikat. Penanda pelajaran selesai, perhitungan kemajuan dari aktivitas wajib, dan penguncian berurutan opsional per course.

**Penilaian.** Bank soal per course (pilihan tunggal, pilihan ganda, benar/salah, isian singkat, esai). Pre-test, kuis, dan ujian akhir dengan jendela waktu, batas percobaan, pengacakan soal dan pilihan, penilaian otomatis, serta antrean pemeriksaan esai untuk trainer.

**Operasional.** Presensi harian, tugas dengan pengumpulan dan penilaian, serta evaluasi pelatihan berikut rekap rata-rata dan masukan tertulis tanpa identitas.

**Sertifikasi.** Pemeriksaan syarat kelulusan per peserta, penerbitan bernomor permanen, PDF dengan kode QR, halaman verifikasi publik, dan pencabutan bercatatan audit.

**Rekam dan laporan.** Riwayat pelatihan peserta, dashboard dan rekam karyawan untuk PIC perusahaan, serta laporan training/peserta/presensi/penilaian/evaluasi dengan ekspor CSV.

## Yang belum tersedia

Unggahan berkas privat belum diaktifkan: materi pendukung dan pengumpulan tugas memakai tautan, dengan kolom `storageKey` yang sudah disiapkan untuk Supabase Storage. Presensi QR, undangan dan notifikasi email, serta provisioning akun otomatis juga belum ada. Isi pelajaran dan soal pada seed adalah contoh dan harus diganti materi yang telah disetujui sebelum dipakai untuk pelatihan sesungguhnya.

## Menjalankan lokal

Node.js 22+ direkomendasikan.

```powershell
npm ci
npm run db:local
```

Salin `.env.example` menjadi `.env`. Isi `DATABASE_URL` dan `DIRECT_URL` dengan URL PostgreSQL dari perintah tersebut. Untuk Prisma Postgres lokal gunakan `connection_limit=1&pgbouncer=true` agar prepared statement tidak bertabrakan. Jangan menggunakan konfigurasi lokal ini untuk database produksi.

Buat `AUTH_SECRET` acak. Untuk demo lokal saja, set `ENABLE_DEMO_AUTH=true` dan `DEMO_PASSWORD` ke nilai acak yang panjang. Demo memiliki tombol peran sehingga kata sandi tidak perlu ditampilkan. `SHADOW_DATABASE_URL` hanya dibutuhkan ketika membuat migrasi baru dengan `prisma migrate dev`.

```powershell
npm run db:migrate
node --env-file=.env --import tsx prisma/seed.ts
npm run dev
```

Buka http://localhost:3000. Akun demo tersedia untuk administrator, trainer, peserta, dan PIC. Seed dapat dijalankan ulang tanpa menggandakan record. Pada workspace ini database lokal bernama `tq-learning-workspace` telah disiapkan; mulai ulang dengan `npx prisma dev --name tq-learning-workspace` bila diperlukan. Port database tersimpan dalam `.env` lokal.

## Deployment

Live: **https://tq-lms.vercel.app** (proyek Vercel `tq-lms`, fungsi di region `sin1`).

### Database: satu proyek Supabase, dua skema terpisah

Proyek Supabase `totalquality-website` sudah dipakai situs perusahaan — skema `public` berisi tabel `Hero`, `News`, `Career`, dan seterusnya, termasuk tabel `User` dan riwayat migrasi Prisma milik situs itu.

LMS karena itu **tidak** memakai `public`. Seluruh tabelnya berada di skema `lms`, dengan peran Postgres `tq_lms_app` yang hanya diberi hak atas skema tersebut. Skema `public` dan kata sandi database milik situs tidak disentuh. Pemisahan ini yang membuat `User` milik LMS dan `User` milik situs dapat hidup berdampingan.

Connection string memakai `?schema=lms`. Pooler transaksi (port 6543) dipakai runtime aplikasi dan pooler sesi (port 5432) dipakai migrasi.

`connection_limit` sengaja tidak diisi 1: nested include Prisma menghasilkan banyak sub-query, dan dengan satu koneksi semuanya mengantre — satu halaman pernah memakan 23 detik dan melewati batas waktu fungsi. Fungsi juga dipasang di `sin1` agar sekamar dengan database; sebelumnya setiap perjalanan bolak-balik menyeberangi Pasifik.

### Login di produksi

`ENABLE_DEMO_AUTH=false` dan `NODE_ENV=production`, jadi tombol peran pada halaman masuk tidak muncul dan akun `isDemo` tidak dapat dipakai. Empat akun peran disediakan lewat Supabase Auth dengan `authId` tertaut ke record `User`. Kredensialnya ada pada `.env.deployment-access.md` (diabaikan git).

Sembilan peserta contoh lainnya tetap `isDemo` — mereka data untuk mengisi daftar dan laporan, bukan akun yang bisa masuk.

### Memperbarui deployment

```powershell
npx vercel deploy --prod
```

`.vercelignore` menahan `.env*` agar berkas rahasia lokal tidak ikut terunggah; nilai untuk produksi berasal dari Environment Variables milik proyek Vercel.


## Verifikasi

```powershell
npm test
npm run typecheck
node --env-file=.env scripts/smoke.mjs
npm run build
```

`npm test` memeriksa aturan domain murni: kemajuan belajar, penguncian berurutan, penilaian otomatis, kehadiran, kelayakan sertifikat, validasi bank soal, dan ekspor CSV. Smoke test memeriksa otorisasi dan seluruh route dengan server pengembangan dan data seed berjalan.

Windows: hentikan `npm run dev` sebelum menjalankan build karena regenerasi Prisma dapat mengunci DLL yang sedang dipakai. Jalankan kembali setelah build.

## Produksi: Supabase + Vercel

1. Buat database Supabase dan isi `DATABASE_URL` dengan connection string pooler yang sesuai; `DIRECT_URL` untuk migrasi. Gunakan SSL.
2. Isi `AUTH_SECRET`, `AUTH_URL` (origin Vercel/domain), `SUPABASE_URL`, dan `SUPABASE_ANON_KEY`. Set `ENABLE_DEMO_AUTH=false`; jangan salin `DEMO_PASSWORD`. Akun `isDemo` tidak boleh digunakan di produksi.
3. Jalankan `npx prisma migrate deploy` melalui pipeline terkontrol. Jangan jalankan demo seed di produksi.
4. Buat akun admin pertama di Supabase Auth dan record User yang sesuai di database dengan `authId` sama dengan UUID Supabase, `role=SUPER_ADMIN`, `active=true`, `isDemo=false`.
5. Akun berikutnya diprovisikan melalui Supabase Auth; masukkan UUID tersebut pada formulir pengguna LMS. Password diverifikasi oleh Supabase; aplikasi tidak menyimpan password. Provisioning otomatis dan undangan email belum diaktifkan.
6. Impor repository ke Vercel dengan framework Next.js. Build command `npm run build`. Siapkan domain, email provider, backup, monitoring, dan uji penerimaan sebelum penggunaan nyata.

Sertifikat diterbitkan hanya ketika syarat kelulusan terpenuhi, bernomor dari urutan yang tidak pernah dipakai ulang, dan dibekukan sebagai snapshot. Halaman verifikasi publik `/verify/<nomor>` hanya menampilkan nama, pelatihan, organisasi, tanggal, dan nomor; email, nilai, dan kehadiran tidak ditampilkan. Berkas PDF hanya dapat diunduh peserta yang bersangkutan, trainer kelas tersebut, PIC organisasinya, dan administrator.

Laporan tidak tersedia untuk peserta: satu training juga memuat teman sekelasnya, sehingga ekspor akan membocorkan data orang lain. Rekam pribadi peserta ada pada halaman Riwayat pelatihan.

Auth.js menggunakan cookie sesi HTTP-only dan pemeriksaan CSRF. Akses selalu diverifikasi ulang ke database; deactivation langsung mencabut akses pada permintaan berikutnya. URL materi hanya menerima http/https; materi eksternal mengikuti kontrol akses penyedianya. Supabase production auth dan Vercel deployment memerlukan konfigurasi akun nyata, dan belum diuji di proyek ini.

Arsitektur, peta route, matriks RBAC, dan rencana bertahap: [docs/architecture.md](docs/architecture.md).
