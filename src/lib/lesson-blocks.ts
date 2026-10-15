/**
 * Isi pelajaran sebagai deretan blok: teks berformat, video, gambar, berkas,
 * tautan, dan catatan. Fungsi murni tanpa impor server, sehingga aturan yang
 * sama dipakai editor di peramban, validasi di server, dan halaman peserta.
 *
 * Blok disimpan sebagai satu kolom JSON pada `Lesson`, bukan tabel tersendiri:
 * urutannya ikut tersimpan apa adanya, satu kali simpan selalu atomik, dan
 * menyalin course ke training cukup menyalin satu nilai.
 */
import { z } from "zod";

import { extensionOf, mimeOf } from "./upload";

/* -------------------------------------------------------------------------
   Berkas
   ------------------------------------------------------------------------- */

/** Semua berkas pelajaran berada di bawah awalan ini pada penyimpanan. */
export const LESSON_PREFIX = "lessons/";

/** Batas ukuran per jenis blok. Video lebih longgar karena klip pendek. */
export const LESSON_LIMITS = {
  video: 100 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  file: 25 * 1024 * 1024,
} as const;

/** Ekstensi yang diterima per jenis blok. SVG sengaja tidak diterima. */
export const LESSON_TYPES = {
  video: ["mp4", "webm"],
  image: ["png", "jpg", "jpeg", "webp", "gif"],
  file: ["pdf", "ppt", "pptx", "doc", "docx", "xls", "xlsx", "csv", "txt", "zip"],
} as const;

export type UploadKind = keyof typeof LESSON_TYPES;

export const fileRefSchema = z.object({
  key: z.string().min(1).max(500).startsWith(LESSON_PREFIX),
  name: z.string().trim().min(1).max(255),
  size: z.number().int().min(0),
});

export type FileRef = z.infer<typeof fileRefSchema>;

/** Alamat berkas pelajaran; wewenangnya diperiksa rute tersebut. */
export function lessonFileUrl(
  lessonId: string,
  file: FileRef,
  download = false,
) {
  const params = new URLSearchParams({ key: file.key });
  if (download) params.set("download", "1");
  return `/api/files/lesson/${lessonId}?${params}`;
}

export const isPdf = (file: FileRef) => extensionOf(file.name) === "pdf";

/* -------------------------------------------------------------------------
   Video sematan
   ------------------------------------------------------------------------- */

/**
 * Alamat sematan untuk tautan video yang didukung, atau null.
 *
 * Hanya penyedia dalam daftar ini yang dapat disematkan — sebuah iframe ke
 * alamat bebas berarti halaman peserta dapat memuat situs apa pun. YouTube
 * dipakai lewat domain nocookie supaya pelacak iklan tidak ikut termuat.
 */
export function videoEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const id = (value: string | null | undefined) =>
    value && /^[A-Za-z0-9_-]{6,64}$/.test(value) ? value : null;

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    const videoId =
      first === "watch"
        ? id(url.searchParams.get("v"))
        : ["embed", "shorts", "live"].includes(first)
          ? id(second)
          : null;
    return videoId
      ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
      : null;
  }
  if (host === "youtu.be") {
    const videoId = id(url.pathname.split("/")[1]);
    return videoId
      ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
      : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts[0] === "video" ? 1 : 0;
    const videoId = /^\d+$/.test(parts[index] ?? "") ? parts[index] : null;
    // Video unlisted memakai hash privat sebagai segmen berikutnya.
    const hash =
      url.searchParams.get("h") ??
      (/^[a-f0-9]{6,32}$/.test(parts[index + 1] ?? "") ? parts[index + 1] : null);
    return videoId
      ? `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ""}`
      : null;
  }
  if (host === "drive.google.com") {
    const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)/);
    const fileId = id(match?.[1] ?? url.searchParams.get("id"));
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
  }
  return null;
}

/* -------------------------------------------------------------------------
   Blok
   ------------------------------------------------------------------------- */

const blockId = z.string().min(1).max(64);
const caption = z.string().trim().max(500).default("");

const httpsUrl = z
  .string()
  .trim()
  .url("Gunakan alamat tautan yang lengkap.")
  .refine((value) => value.startsWith("https://"), "Gunakan tautan HTTPS.");

export const lessonBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: blockId,
    type: z.literal("text"),
    html: z.string().max(200_000),
  }),
  z.object({
    id: blockId,
    type: z.literal("video"),
    url: z.string().trim().max(2000).default(""),
    file: fileRefSchema.nullable().default(null),
    caption,
  }),
  z.object({
    id: blockId,
    type: z.literal("image"),
    file: fileRefSchema.nullable().default(null),
    alt: z.string().trim().max(300).default(""),
    caption,
  }),
  z.object({
    id: blockId,
    type: z.literal("file"),
    file: fileRefSchema.nullable().default(null),
    title: z.string().trim().max(200).default(""),
    description: caption,
  }),
  z.object({
    id: blockId,
    type: z.literal("link"),
    url: z.string().trim().max(2000).default(""),
    title: z.string().trim().max(200).default(""),
    description: caption,
  }),
  z.object({
    id: blockId,
    type: z.literal("callout"),
    tone: z.enum(["info", "tip", "warning"]).default("info"),
    text: z.string().trim().max(2000).default(""),
  }),
]);

export type LessonBlock = z.infer<typeof lessonBlockSchema>;
export type BlockType = LessonBlock["type"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  text: "Teks",
  video: "Video",
  image: "Gambar",
  file: "Dokumen",
  link: "Tautan",
  callout: "Catatan",
};

/** Blok kosong untuk jenis tertentu, dipakai editor saat menambah blok. */
export function emptyBlock(type: BlockType, id: string): LessonBlock {
  switch (type) {
    case "text":
      return { id, type, html: "" };
    case "video":
      return { id, type, url: "", file: null, caption: "" };
    case "image":
      return { id, type, file: null, alt: "", caption: "" };
    case "file":
      return { id, type, file: null, title: "", description: "" };
    case "link":
      return { id, type, url: "", title: "", description: "" };
    case "callout":
      return { id, type, tone: "info", text: "" };
  }
}

/**
 * Daftar blok yang tersimpan, tanpa pernah melempar: data yang rusak atau
 * dari versi lama tidak boleh membuat halaman peserta gagal dibuka. Blok yang
 * tidak dikenali dilewati saja.
 */
export function readBlocks(value: unknown): LessonBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = lessonBlockSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Teks HTML tanpa tag, untuk memeriksa apakah blok teks benar-benar berisi. */
export function plainText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kesalahan pertama pada isi pelajaran, atau null. Pesannya menyebut nomor
 * blok supaya penulis tahu bagian mana yang harus diperbaiki.
 */
export function blocksError(blocks: LessonBlock[]): string | null {
  for (const [index, block] of blocks.entries()) {
    const at = `Blok ${index + 1} (${BLOCK_LABELS[block.type]})`;
    if (block.type === "text" && !plainText(block.html) && !/<img|<table/.test(block.html))
      return `${at} masih kosong.`;
    if (block.type === "video") {
      if (!block.file && !block.url) return `${at}: unggah video atau isi tautannya.`;
      if (!block.file && !videoEmbedUrl(block.url))
        return `${at}: tautan video harus dari YouTube, Vimeo, atau Google Drive.`;
    }
    if (block.type === "image") {
      if (!block.file) return `${at}: unggah gambarnya.`;
      if (!block.alt) return `${at}: isi teks alternatif untuk pembaca layar.`;
    }
    if (block.type === "file" && !block.file) return `${at}: unggah berkasnya.`;
    if (block.type === "link" && !httpsUrl.safeParse(block.url).success)
      return `${at}: isi tautan HTTPS yang lengkap.`;
    if (block.type === "callout" && !block.text) return `${at} masih kosong.`;
  }
  return null;
}

/** Semua berkas yang dirujuk isi pelajaran. */
export function blockFiles(blocks: LessonBlock[]): FileRef[] {
  return blocks.flatMap((block) =>
    "file" in block && block.file ? [block.file] : [],
  );
}

/**
 * Jenis utama pelajaran untuk label di daftar materi: media pertama yang
 * ditemukan, atau teks bila pelajaran hanya berisi tulisan.
 */
export function primaryType(
  blocks: LessonBlock[],
): "TEXT" | "PDF" | "VIDEO" | "IMAGE" | "FILE" | "EXTERNAL_LINK" {
  for (const block of blocks) {
    if (block.type === "video") return "VIDEO";
    if (block.type === "file" && block.file)
      return isPdf(block.file) ? "PDF" : "FILE";
    if (block.type === "image") return "IMAGE";
    if (block.type === "link") return "EXTERNAL_LINK";
  }
  return "TEXT";
}

/** Tipe MIME berkas pelajaran, ditentukan dari ekstensinya. */
export const lessonMime = (file: FileRef) => mimeOf(file.name);
