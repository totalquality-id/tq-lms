# Total Quality Learning

Learning Management System untuk PT Total Quality Indonesia. Dibangun dengan Next.js 16, TypeScript, Tailwind CSS, Radix, Auth.js, Prisma, dan PostgreSQL.

Platform ini mendampingi satu siklus pelatihan utuh: undangan, pendaftaran, pre-test, materi, tugas, ujian akhir, evaluasi, sertifikat, dan rekam kompetensi peserta.

## Fitur yang tersedia

**Administrasi pelatihan.** Organisasi klien, pengguna dan peran, course beserta modul dan pelajaran yang dapat diurutkan, training batch dengan jadwal, kapasitas, penugasan trainer, dan pendaftaran peserta.

**Pembelajaran.** Halaman training peserta dengan tab Ringkasan, Materi, Penilaian, Tugas, Materi pendukung, Evaluasi, dan Sertifikat. Penanda pelajaran selesai, perhitungan kemajuan dari aktivitas wajib, dan penguncian berurutan opsional per course.

**Penilaian.** Bank soal per course (pilihan tunggal, pilihan ganda, benar/salah, isian singkat, esai). Pre-test, kuis, dan ujian akhir dengan jendela waktu, batas percobaan, pengacakan soal dan pilihan, penilaian otomatis, serta antrean pemeriksaan esai untuk trainer.

Sumber soal dapat dipilih per penilaian: seluruh bank soal course, daftar yang disusun trainer sendiri, atau sejumlah soal acak per topik — misalnya 2 soal Klausul 4, 2 soal Annex A. Aturan per topik ditolak saat disimpan bila bank soal belum mencukupi, bukan dibiarkan muncul ketika peserta menekan "mulai".

**Operasional.** Presensi harian, tugas dengan pengumpulan dan penilaian, serta evaluasi pelatihan berikut rekap rata-rata dan masukan tertulis tanpa identitas.

**Sertifikasi.** Pemeriksaan syarat kelulusan per peserta, penerbitan bernomor permanen, PDF dengan kode QR, halaman verifikasi publik, dan pencabutan bercatatan audit.

**Akun dan akses.** Undangan akun sekali pakai, penyetelan kata sandi oleh pemiliknya sendiri, penyetelan ulang oleh administrator maupun lewat formulir "lupa kata sandi". Tautan berlaku sekali dan kedaluwarsa; yang tersimpan di basis data hanya hash-nya.

**Rekam dan laporan.** Riwayat pelatihan peserta, dashboard dan rekam karyawan untuk PIC perusahaan, serta laporan training/peserta/presensi/penilaian/evaluasi dengan ekspor CSV.

## Yang belum tersedia

Pengiriman surel otomatis belum aktif: tautan undangan dan penyetelan ulang diteruskan oleh administrator dari halaman Pengguna, dan permintaan yang menunggu muncul pada daftar "Perlu ditindaklanjuti" di dashboard. Unggahan berkas privat belum diaktifkan: materi pendukung dan pengumpulan tugas memakai tautan, dengan kolom `storageKey` yang sudah disiapkan untuk Supabase Storage. Presensi QR, undangan dan notifikasi email, serta provisioning akun otomatis juga belum ada. Materi pelajaran dan soal dibuat sendiri setelah masuk; seed tidak menyediakan data pelatihan.

## Konfigurasi database dan akun

Aplikasi memakai project Supabase **tq-lms** (`hdjumgxtubpruwlluahs`), skema `lms`, dengan peran Postgres `tq_lms_app`. Database, Supabase Auth, dan Storage harus berasal dari project yang sama. Project lama `totalquality-website` bukan sumber data aplikasi ini lagi.

`DATABASE_URL` menggunakan transaction pooler port 6543 dengan `pgbouncer=true&connection_limit=5&schema=lms&sslmode=require`. `DIRECT_URL` menggunakan session pooler port 5432 dengan `schema=lms&sslmode=require` untuk migrasi. Host pooler tersedia di panel Connect Supabase; username memakai format `tq_lms_app.<project-ref>`.

Nilai rahasia tersimpan pada `.env` lokal dan Environment Variables Vercel. `.env.supabase-secret` menyimpan salinan koneksi deployment. Berkas tersebut serta folder `.local/` diabaikan Git dan tidak diunggah ke Vercel.

## Menjalankan lokal

Gunakan Node.js 22+. Salin `.env.example` menjadi `.env` hanya pada instalasi baru, lalu isi koneksi project dan kunci Supabase. Set `AUTH_URL=http://localhost:3000`, buat `AUTH_SECRET` acak, dan gunakan `ENABLE_DEMO_AUTH=false`.

```powershell
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

`db:deploy` menerapkan migrasi yang sudah tersedia. `db:migrate` khusus membuat migrasi baru pada database pengembangan terpisah; isi `SHADOW_DATABASE_URL` dengan database sementara yang terpisah. Jangan memakai database aplikasi sebagai shadow database.

Setelah mengambil perubahan schema atau migrasi, hentikan server lokal lalu jalankan `npm run db:deploy` dan `npm run db:generate` sebelum `npm run dev`. `prisma generate` hanya memperbarui client, bukan struktur database. Error seperti `The column Course.sourceCourseId does not exist` berarti database belum memiliki kolom yang digunakan kode; periksa dengan `npx prisma migrate status` dan terapkan migrasi yang tertunda.

Seed hanya membuat atau memperbarui:

- Organisasi PT Globalindo Intimates.
- Admin `center@tq-official.com` (SUPER_ADMIN).
- Sembilan trainer yang tercantum dalam `prisma/seed.ts`.
- Sepuluh peserta: `participant@globalindointimates.com` dan `participant2@globalindointimates.com` sampai `participant10@globalindointimates.com`, seluruhnya anggota PT Globalindo Intimates.

Seed tidak membuat course, training, soal, aktivitas belajar, nilai, atau sertifikat. Menjalankannya ulang tidak menggandakan akun dan tidak menghapus pekerjaan yang sudah dibuat. Ini bukan perintah reset database. Seluruh akun menggunakan Supabase Auth sungguhan (`isDemo=false`); seed tidak menetapkan password bersama atau mengirim email.

Untuk akun baru, administrator dapat membuat tautan pengaturan password dari halaman Pengguna. Tautan bootstrap awal disimpan secara lokal pada `.env.deployment-access.md`; tautan berlaku sekali selama tujuh hari sejak dibuat. Jangan membagikan berkas seluruh akun kepada peserta.

## Deployment

Live: **https://tq-lms.vercel.app** (project Vercel `tq-lms`, region `sin1`).

Production dan preview memakai koneksi Supabase `tq-lms` yang sama. `ENABLE_DEMO_AUTH=false`. Perubahan Environment Variables berlaku setelah deployment baru dibuat.

Bucket `training-resources` bersifat privat. Jalankan `npm run storage:setup` untuk memeriksa unggah, metadata, unduh bertanda tangan, dan penghapusan file uji.


### Memperbarui deployment

```powershell
npm run db:deploy
npx vercel deploy --prod
```

Migrasi harus berhasil sebelum kode baru dideploy. Build hanya menjalankan `prisma generate`; build tidak menerapkan migrasi database.

`.vercelignore` menahan `.env*` agar berkas rahasia lokal tidak ikut terunggah; nilai untuk produksi berasal dari Environment Variables milik proyek Vercel.

## Verifikasi

```powershell
npm test
npm run typecheck
npm run build
```

`npm test` memeriksa aturan domain murni: kemajuan belajar, penguncian berurutan, penilaian otomatis, kehadiran, kelayakan sertifikat, validasi bank soal, dan ekspor CSV. Smoke test lama (`scripts/smoke.mjs`) bergantung pada fixture demo yang sudah dihapus dari seed; jangan jalankan pada database bersih ini. Verifikasi alur baru dengan akun Supabase dan data pelatihan yang dibuat sendiri.

Windows: hentikan `npm run dev` sebelum menjalankan build karena regenerasi Prisma dapat mengunci DLL yang sedang dipakai. Jalankan kembali setelah build.

## Produksi: Supabase + Vercel

1. Buat database Supabase dan isi `DATABASE_URL` dengan connection string pooler yang sesuai; `DIRECT_URL` untuk migrasi. Gunakan SSL.
2. Isi `AUTH_SECRET`, `AUTH_URL` (origin Vercel/domain), `SUPABASE_URL`, dan `SUPABASE_ANON_KEY`. Set `ENABLE_DEMO_AUTH=false`; jangan salin `DEMO_PASSWORD`. Akun `isDemo` tidak boleh digunakan di produksi.
3. Jalankan `npx prisma migrate deploy` melalui pipeline terkontrol. Jangan jalankan demo seed di produksi.
4. Buat akun admin pertama di Supabase Auth dan record User yang sesuai di database dengan `authId` sama dengan UUID Supabase, `role=SUPER_ADMIN`, `active=true`, `isDemo=false`.
5. Akun berikutnya diundang dari halaman Pengguna: akun Supabase Auth disiapkan lebih dulu, lalu tautan sekali pakai diterbitkan. Password ditetapkan pemiliknya sendiri dan diverifikasi Supabase; aplikasi tidak pernah menyimpan password. Provisioning otomatis dari sistem HR belum diaktifkan.
6. Isi `SUPABASE_STORAGE_BUCKET` lalu jalankan `npm run storage:setup` agar bucket berkas privat siap. Bucket wajib privat — berkas tugas dan materi kelas tidak boleh terbaca oleh siapa pun yang menebak alamatnya.
7. Isi `RESEND_API_KEY` dan `MAIL_FROM` dengan domain pengirim yang sudah terverifikasi agar undangan, penyetelan ulang kata sandi, dan pemberitahuan penting terkirim sebagai surel.
8. Impor repository ke Vercel dengan framework Next.js. Build command `npm run build`. Siapkan domain, backup, monitoring, dan uji penerimaan sebelum penggunaan nyata.

Sertifikat diterbitkan hanya ketika syarat kelulusan terpenuhi, bernomor dari urutan yang tidak pernah dipakai ulang, dan dibekukan sebagai snapshot. Halaman verifikasi publik `/verify/<nomor>` hanya menampilkan nama, pelatihan, organisasi, tanggal, dan nomor; email, nilai, dan kehadiran tidak ditampilkan. Berkas PDF hanya dapat diunduh peserta yang bersangkutan, trainer kelas tersebut, PIC organisasinya, dan administrator.

Laporan tidak tersedia untuk peserta: satu training juga memuat teman sekelasnya, sehingga ekspor akan membocorkan data orang lain. Rekam pribadi peserta ada pada halaman Riwayat pelatihan.

Auth.js menggunakan cookie sesi HTTP-only dan pemeriksaan CSRF. Akses selalu diverifikasi ulang ke database; deactivation langsung mencabut akses pada permintaan berikutnya. URL materi hanya menerima http/https; materi eksternal mengikuti kontrol akses penyedianya. Berkas yang diunggah tersimpan pada bucket privat dan tidak punya alamat tetap: `/api/files/<jenis>/<id>` memeriksa ulang wewenang pada setiap permintaan lalu mengalihkan ke tautan bertanda tangan berumur satu menit, sehingga alamat yang terlanjur tersalin tetap melewati pemeriksaan yang sama. Koneksi database, Supabase Auth, serta Storage diperiksa setelah konfigurasi project diperbarui.

Arsitektur, peta route, matriks RBAC, dan rencana bertahap: [docs/architecture.md](docs/architecture.md).
