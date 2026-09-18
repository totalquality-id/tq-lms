/**
 * Aturan berkas unggahan: apa yang boleh diterima, sebesar apa, dan di mana ia
 * disimpan. Fungsi murni tanpa impor server, sehingga aturan yang sama dipakai
 * server saat menandatangani unggahan dan saat memverifikasi hasilnya.
 */

/**
 * Jenis berkas yang diterima, dipetakan dari ekstensi ke tipe MIME-nya.
 *
 * Daftar putih ekstensi, bukan tipe MIME yang dikirim peramban: header
 * Content-Type berasal dari sisi pengunggah dan dapat ditulis apa saja,
 * sedangkan ekstensi itulah yang nanti menentukan bagaimana berkas dibuka
 * penerimanya. Berkas yang dapat dieksekusi tidak pernah masuk daftar ini.
 */
export const UPLOAD_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  zip: "application/zip",
  mp4: "video/mp4",
};

/** Batas ukuran materi pendukung. Tugas memakai `Assignment.maxBytes`. */
export const RESOURCE_MAX_BYTES = 25 * 1024 * 1024;

export function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/**
 * Alasan satu berkas ditolak, atau null bila ia diterima. Mengembalikan
 * kalimat alih-alih boolean supaya pesan yang dibaca pengunggah selalu
 * menyebutkan hal yang dapat ia perbaiki sendiri.
 */
export function uploadError(
  filename: string,
  size: number,
  maxBytes: number,
  allowed: readonly string[] = Object.keys(UPLOAD_TYPES),
): string | null {
  const extension = extensionOf(filename);
  if (!extension) return "Berkas tanpa ekstensi tidak dapat diunggah.";
  if (!allowed.includes(extension))
    return `Jenis berkas .${extension} tidak diterima. Gunakan ${allowed
      .slice(0, 6)
      .map((item) => `.${item}`)
      .join(", ")}, atau format lain yang disebutkan trainer.`;
  if (size <= 0) return "Berkas kosong tidak dapat diunggah.";
  if (size > maxBytes)
    return `Ukuran berkas melebihi batas ${fileSize(maxBytes)}.`;
  return null;
}

/** Tipe MIME yang disimpan, ditentukan dari ekstensi, bukan dari peramban. */
export function mimeOf(filename: string) {
  return UPLOAD_TYPES[extensionOf(filename)] ?? "application/octet-stream";
}

/**
 * Nama berkas yang aman untuk dipakai sebagai satu segmen jalur penyimpanan:
 * hanya huruf, angka, titik, garis, dan strip, dengan panjang dibatasi.
 */
export function safeFileName(filename: string) {
  const extension = extensionOf(filename);
  const base = filename
    .slice(0, filename.length - (extension ? extension.length + 1 : 0))
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "berkas"}${extension ? `.${extension}` : ""}`;
}

/**
 * Kunci objek penyimpanan.
 *
 * Nama asli berkas ikut disimpan sebagai segmen terakhir supaya tautan unduhan
 * mengembalikan nama yang dikenali pemiliknya tanpa perlu kolom basis data
 * tambahan. Ia selalu berada di bawah satu direktori beridentitas acak buatan
 * server, jadi nama yang sama dari dua orang tidak pernah bertabrakan dan
 * tidak ada isian pengguna yang dapat keluar dari awalannya.
 */
export function storageKey(prefix: string[], id: string, filename: string) {
  return [...prefix, id, safeFileName(filename)].join("/");
}

/** Nama berkas yang tersimpan di dalam sebuah kunci objek. */
export function fileNameOf(key: string) {
  return key.slice(key.lastIndexOf("/") + 1);
}
