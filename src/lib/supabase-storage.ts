import "server-only";

/**
 * Penyimpanan berkas privat di Supabase Storage.
 *
 * Bucket-nya privat: tidak ada satu pun objek yang dapat dibaca tanpa tautan
 * bertanda tangan yang baru saja diterbitkan server setelah wewenang pembaca
 * diperiksa. Kunci service role tidak pernah meninggalkan server — peramban
 * hanya menerima tautan sekali pakai yang terikat pada satu objek dan mati
 * dalam hitungan detik.
 *
 * REST API dipakai langsung, sejalan dengan `supabase-admin.ts`: yang
 * dibutuhkan hanya empat endpoint, dan klien penuh membawa serta manajemen
 * sesi yang tidak diinginkan di sisi server.
 */

/** Umur tautan unduhan. Cukup untuk memulai unduhan, bukan untuk dibagikan. */
const DOWNLOAD_TTL = 60;

export function storageConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_STORAGE_BUCKET,
  );
}

function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !key || !bucket)
    throw new Error(
      "Penyimpanan berkas belum dikonfigurasi pada lingkungan ini, sehingga unggahan tidak tersedia.",
    );
  return {
    base: `${url.replace(/\/$/, "")}/storage/v1`,
    bucket,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
}

const encodeKey = (key: string) =>
  key.split("/").map(encodeURIComponent).join("/");

export type SignedUpload = { key: string; url: string };

/**
 * Tautan unggah untuk satu objek.
 *
 * Peramban mengunggah langsung ke Supabase, bukan melalui fungsi server:
 * berkas 25 MB yang melewati fungsi Vercel akan menabrak batas ukuran badan
 * permintaan, dan menyalin byte yang sama dua kali hanya menambah satu titik
 * gagal. Tandanya terikat pada satu kunci, jadi ia tidak dapat dipakai untuk
 * menulis objek lain.
 */
export async function signUpload(key: string): Promise<SignedUpload> {
  const { base, bucket, headers } = storage();
  const response = await fetch(
    `${base}/object/upload/sign/${bucket}/${encodeKey(key)}`,
    { method: "POST", headers, body: "{}" },
  );
  const body = (await response.json().catch(() => ({}))) as {
    url?: string;
    signedUrl?: string;
    message?: string;
  };
  const signed = body.url ?? body.signedUrl;
  if (!response.ok || !signed)
    throw new Error(
      body.message ?? "Tautan unggah gagal dibuat. Silakan coba kembali.",
    );
  return { key, url: `${base}${signed.startsWith("/") ? "" : "/"}${signed}` };
}

/**
 * Tautan unduhan sekali pakai. `download` membuat Supabase mengirim header
 * Content-Disposition, sehingga berkas tersimpan dengan namanya semula alih-alih
 * dibuka sebagai dokumen bernama acak.
 */
export async function signDownload(key: string, filename: string) {
  const { base, bucket, headers } = storage();
  const response = await fetch(
    `${base}/object/sign/${bucket}/${encodeKey(key)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ expiresIn: DOWNLOAD_TTL }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    signedURL?: string;
    signedUrl?: string;
    message?: string;
  };
  const signed = body.signedURL ?? body.signedUrl;
  if (!response.ok || !signed) return null;
  const url = `${base}${signed.startsWith("/") ? "" : "/"}${signed}`;
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(filename)}`;
}

export type ObjectInfo = { size: number; mimeType: string };

/**
 * Ukuran dan tipe objek seperti yang tercatat penyimpanan.
 *
 * Diperiksa setelah unggahan selesai, bukan hanya sebelum tanda tangan dibuat:
 * ukuran yang dikirim peramban sebelum mengunggah adalah pernyataan, bukan
 * bukti. Baris basis data baru dibuat setelah objeknya benar-benar ada dan
 * ukurannya memang berada di bawah batas.
 */
export async function objectInfo(key: string): Promise<ObjectInfo | null> {
  const { base, bucket, headers } = storage();
  const slash = key.lastIndexOf("/");
  const response = await fetch(`${base}/object/list/${bucket}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prefix: slash > 0 ? key.slice(0, slash) : "",
      search: key.slice(slash + 1),
      limit: 1,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = (await response.json().catch(() => [])) as {
    name?: string;
    metadata?: { size?: number; mimetype?: string } | null;
  }[];
  const found = Array.isArray(rows)
    ? rows.find((row) => row.name === key.slice(slash + 1))
    : undefined;
  if (!found?.metadata) return null;
  return {
    size: Number(found.metadata.size ?? 0),
    mimeType: found.metadata.mimetype ?? "application/octet-stream",
  };
}

/** Menghapus objek. Dipakai untuk membersihkan unggahan yang ditolak. */
export async function removeObject(key: string) {
  const { base, bucket, headers } = storage();
  await fetch(`${base}/object/${bucket}`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ prefixes: [key] }),
  }).catch(() => undefined);
}
