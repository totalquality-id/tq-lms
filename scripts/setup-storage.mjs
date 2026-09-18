/**
 * Menyiapkan bucket penyimpanan berkas lalu mengujinya sekali jalan.
 *
 * Dijalankan sengaja oleh orang, bukan oleh aplikasi: membuat bucket adalah
 * perubahan pada proyek Supabase, dan aplikasi yang membuat sendiri wadah
 * penyimpanannya saat permintaan pertama masuk akan menyembunyikan salah ketik
 * pada nama bucket produksi sampai berkasnya sudah menumpuk di tempat keliru.
 *
 * Idempoten: dijalankan ulang tidak menggandakan apa pun, dan berkas uji yang
 * dibuatnya selalu dihapus kembali.
 *
 *   node --env-file=.env scripts/setup-storage.mjs
 */

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET;

if (!url || !key || !bucket)
  throw new Error(
    "Isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan SUPABASE_STORAGE_BUCKET terlebih dahulu.",
  );

/** Sejalan dengan RESOURCE_MAX_BYTES pada src/lib/upload.ts. */
const MAX_BYTES = 25 * 1024 * 1024;

const base = `${url}/storage/v1`;
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const api = async (path, init = {}) => {
  const response = await fetch(base + path, {
    ...init,
    headers,
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
};

/* --------------------------------- Bucket --------------------------------- */

const existing = await api(`/bucket/${bucket}`);
if (existing.ok) {
  if (existing.body.public)
    throw new Error(
      `Bucket "${bucket}" bersifat publik. Berkas tugas dan materi kelas tidak boleh dapat dibaca siapa pun yang menebak alamatnya — ubah menjadi privat sebelum melanjutkan.`,
    );
  console.log(`Bucket "${bucket}" sudah ada dan bersifat privat.`);
} else {
  const created = await api("/bucket", {
    method: "POST",
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: false,
      file_size_limit: MAX_BYTES,
    }),
  });
  if (!created.ok)
    throw new Error(
      `Bucket gagal dibuat (${created.status}): ${created.body.message ?? "tanpa keterangan"}`,
    );
  console.log(`Bucket "${bucket}" dibuat sebagai bucket privat.`);
}

/* ------------------------------ Uji satu putaran --------------------------- */
// Menandatangani, mengunggah, membaca ukurannya, menandatangani unduhan, lalu
// menghapus — persis jalur yang dipakai aplikasi. Kalau kunci service role
// kurang wewenang, kegagalannya terlihat di sini, bukan saat trainer pertama
// mencoba mengunggah materi.

const probe = `diagnostik/${Date.now()}/uji.txt`;
const payload = "uji penyimpanan TQ Learning";
let failed = false;

const signed = await api(`/object/upload/sign/${bucket}/${probe}`, {
  method: "POST",
  body: "{}",
});
const target = signed.body.url ?? signed.body.signedUrl;
if (!signed.ok || !target)
  throw new Error(
    `Tautan unggah gagal dibuat (${signed.status}): ${signed.body.message ?? "tanpa keterangan"}`,
  );

const put = await fetch(
  `${base}${target.startsWith("/") ? "" : "/"}${target}`,
  {
    method: "PUT",
    headers: { "x-upsert": "true", "content-type": "text/plain" },
    body: payload,
  },
);
if (!put.ok) throw new Error(`Unggahan uji gagal (${put.status}).`);

const slash = probe.lastIndexOf("/");
const listed = await api(`/object/list/${bucket}`, {
  method: "POST",
  body: JSON.stringify({
    prefix: probe.slice(0, slash),
    search: probe.slice(slash + 1),
    limit: 1,
  }),
});
const found = Array.isArray(listed.body) ? listed.body[0] : null;
if (found?.metadata?.size !== payload.length) {
  console.error(
    `PERINGATAN: ukuran objek tidak terbaca kembali. Aplikasi memakai pembacaan ini untuk menolak berkas yang melebihi batas setelah diunggah.`,
  );
  failed = true;
}

const download = await api(`/object/sign/${bucket}/${probe}`, {
  method: "POST",
  body: JSON.stringify({ expiresIn: 60 }),
});
if (!(download.body.signedURL ?? download.body.signedUrl)) {
  console.error("PERINGATAN: tautan unduhan bertanda tangan gagal dibuat.");
  failed = true;
}

await fetch(`${base}/object/${bucket}`, {
  method: "DELETE",
  headers,
  body: JSON.stringify({ prefixes: [probe] }),
});

console.log(
  failed
    ? "Bucket siap, tetapi ada langkah yang gagal di atas. Periksa wewenang kunci service role."
    : "Unggah, baca ukuran, tanda tangan unduhan, dan hapus: seluruhnya berhasil. Penyimpanan siap dipakai.",
);
process.exit(failed ? 1 : 0);
