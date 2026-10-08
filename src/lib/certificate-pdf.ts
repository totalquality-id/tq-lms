import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";

import type { CertificateSnapshot } from "@/services/certificate";
import { TZ } from "@/lib/utils";

const BLUE = rgb(0x0c / 255, 0x4b / 255, 0x96 / 255);
const INK = rgb(0x33 / 255, 0x2c / 255, 0x2b / 255);
const NUMBER_INK = rgb(0x16 / 255, 0x1c / 255, 0x24 / 255);
const BULLET = rgb(0xe6 / 255, 0x21 / 255, 0x29 / 255);

const ASSETS = path.join(process.cwd(), "src/lib/certificate-assets");

/**
 * Latar sertifikat (A4 tegak) adalah PDF desain dari tim, dengan semua isian
 * yang berubah per peserta sudah dikosongkan. Berkasnya dimuat sekali per
 * instance server; dokumen baru tetap dibuat ulang setiap permintaan.
 */
let assets: Promise<{ template: Uint8Array; heading: Uint8Array }> | null =
  null;
function loadAssets() {
  assets ??= Promise.all([
    readFile(path.join(ASSETS, "template.pdf")),
    readFile(path.join(ASSETS, "Montserrat-Bold.ttf")),
  ]).then(([template, heading]) => ({ template, heading }));
  return assets;
}

/**
 * Koordinat di bawah diukur dari desain asli dan dinyatakan dari tepi atas
 * halaman, sama seperti di aplikasi desainnya; `top()` membaliknya ke sumbu
 * PDF yang berawal di kiri bawah.
 */
const LAYOUT = {
  number: { x: 149.77, y: 206.5, size: 11 },
  fields: { x: 165.81, y: [256.5, 279.9, 303.31], size: 14 },
  heading: { x: 75.71, y: 339.16, leading: 24.59, size: 20, maxWidth: 444 },
  subjects: { x: 107.28, y: 440.74, bottom: 562, leading: 17.23, size: 11 },
  bullet: { x: 95.48, rise: 3.13, radius: 2.72 },
  sign: { right: 499.58, y: 615.6, size: 12 },
  qr: { x: 93.78, y: 732.28, size: 81.66 },
  right: 520,
} as const;

/**
 * Sertifikat dibangun sebagai PDF sungguhan, bukan tangkapan halaman, supaya
 * teksnya dapat dicari dan disalin serta ukurannya tetap kecil saat dilampirkan
 * pada surat elektronik.
 *
 * Kode QR menunjuk ke halaman verifikasi publik. Yang membuktikan keaslian
 * adalah halaman itu, bukan lembarannya: berkas PDF selalu dapat ditiru,
 * catatan di basis data tidak.
 */
export async function renderCertificatePdf(
  number: string,
  snapshot: CertificateSnapshot,
  verifyUrl: string,
  issuedAt: Date,
): Promise<Uint8Array> {
  const files = await loadAssets();
  const pdf = await PDFDocument.load(files.template);
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Sertifikat ${number}`);
  pdf.setAuthor("PT Total Quality Indonesia");
  pdf.setSubject(snapshot.training);
  pdf.setProducer("Total Quality Learning");
  pdf.setCreator("Total Quality Learning");

  const page = pdf.getPage(0);
  const height = page.getHeight();
  const top = (y: number) => height - y;

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const heading = await pdf.embedFont(files.heading, { subset: true });

  const write = (
    text: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont,
    color = INK,
  ) => page.drawText(text, { x, y: top(y), size, font, color });

  write(
    printable(number, bold),
    LAYOUT.number.x,
    LAYOUT.number.y,
    LAYOUT.number.size,
    bold,
    NUMBER_INK,
  );

  const fieldWidth = LAYOUT.right - LAYOUT.fields.x;
  [
    snapshot.participant.toUpperCase(),
    snapshot.organization ?? "-",
    trainingDate(snapshot),
  ].forEach((value, index) => {
    const text = printable(value, bold);
    const size = shrink(text, bold, LAYOUT.fields.size, 10, fieldWidth);
    write(
      fit(text, bold, size, fieldWidth),
      LAYOUT.fields.x,
      LAYOUT.fields.y[index],
      size,
      bold,
    );
  });

  // Judul training: baris pertama biru, sisanya gelap, mengikuti desain
  // "Awareness of ISO 9001:2026 / Quality Management System".
  const title = printable(snapshot.training, heading);
  const { lines, size: titleSize } = headingLines(title, heading);
  lines.forEach((line, index) =>
    write(
      line,
      LAYOUT.heading.x,
      LAYOUT.heading.y + index * LAYOUT.heading.leading,
      titleSize,
      heading,
      index === 0 ? BLUE : INK,
    ),
  );

  drawSubjects(
    (snapshot.subjects ?? []).map((subject) => printable(subject, regular)),
    regular,
    (text, x, y, size) => write(text, x, y, size, regular),
    (x, y, size) =>
      page.drawCircle({
        x,
        y: top(y),
        size: LAYOUT.bullet.radius * (size / LAYOUT.subjects.size),
        color: BULLET,
      }),
  );

  const sign = `Surabaya, ${signDate(issuedAt)}`;
  write(
    sign,
    LAYOUT.sign.right - regular.widthOfTextAtSize(sign, LAYOUT.sign.size),
    LAYOUT.sign.y,
    LAYOUT.sign.size,
    regular,
  );

  const qrPng = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    margin: 1,
    width: 400,
    errorCorrectionLevel: "M",
    color: { dark: "#173e76", light: "#FFFFFF" },
  });
  const qr = await pdf.embedPng(qrPng);
  page.drawImage(qr, {
    x: LAYOUT.qr.x,
    y: top(LAYOUT.qr.y),
    width: LAYOUT.qr.size,
    height: LAYOUT.qr.size,
  });

  return pdf.save();
}

/**
 * Daftar materi menempati ruang tetap di atas garis pemisah. Bila modulnya
 * banyak, jarak baris dirapatkan lebih dulu, lalu dipecah menjadi dua kolom,
 * supaya daftar tidak pernah menabrak blok tanda tangan.
 */
function drawSubjects(
  subjects: string[],
  font: PDFFont,
  text: (value: string, x: number, y: number, size: number) => void,
  bullet: (x: number, y: number, size: number) => void,
) {
  const {
    x,
    y,
    bottom,
    leading: baseLeading,
    size: baseSize,
  } = LAYOUT.subjects;
  const items = subjects.filter(Boolean).slice(0, 24);
  if (!items.length) return;

  const columns = items.length > 11 ? 2 : 1;
  const rows = Math.ceil(items.length / columns);
  const leading = Math.min(baseLeading, (bottom - y) / Math.max(rows - 1, 1));
  const size = Math.min(baseSize, leading * 0.72);
  const columnWidth = (LAYOUT.right - x) / columns;
  const bulletOffset = x - LAYOUT.bullet.x;

  items.forEach((item, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    const left = x + column * columnWidth;
    const baseline = y + row * leading;
    bullet(
      left - bulletOffset,
      baseline - LAYOUT.bullet.rise * (size / baseSize),
      size,
    );
    text(
      fit(item, font, size, columnWidth - bulletOffset - 6),
      left,
      baseline,
      size,
    );
  });
}

/**
 * Judul yang tidak muat satu baris dibagi dua pada titik yang membuat kedua
 * baris paling seimbang, lalu dikecilkan bila baris terpanjang masih melebihi
 * ruang yang tersedia.
 */
function headingLines(title: string, font: PDFFont) {
  const { size: base, maxWidth } = LAYOUT.heading;
  const width = (value: string, size: number) =>
    font.widthOfTextAtSize(value, size);

  if (width(title, base) <= maxWidth) return { lines: [title], size: base };

  const words = title.split(/\s+/);
  let lines = [title];
  let widest = Infinity;
  for (let cut = 1; cut < words.length; cut++) {
    const candidate = [
      words.slice(0, cut).join(" "),
      words.slice(cut).join(" "),
    ];
    const longest = Math.max(...candidate.map((line) => width(line, base)));
    if (longest < widest) {
      widest = longest;
      lines = candidate;
    }
  }

  let size = base;
  while (size > 12 && lines.some((line) => width(line, size) > maxWidth))
    size -= 0.5;
  return { lines: lines.map((line) => fit(line, font, size, maxWidth)), size };
}

/** "07 Oktober 2026", "01 – 03 Oktober 2026", atau rentang lintas bulan. */
function trainingDate(snapshot: CertificateSnapshot) {
  const format = (value: string, parts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...parts }).format(
      new Date(value),
    );
  const full = { day: "2-digit", month: "long", year: "numeric" } as const;
  const { startDate: start, endDate: end } = snapshot;

  if (start === end) return format(start, full);
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${format(start, { day: "2-digit" })} – ${format(end, full)}`;
  if (start.slice(0, 4) === end.slice(0, 4))
    return `${format(start, { day: "2-digit", month: "long" })} – ${format(end, full)}`;
  return `${format(start, full)} – ${format(end, full)}`;
}

/** Tanggal penerbitan di atas tanda tangan, berbahasa Inggris sesuai desain. */
function signDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(value);
}

/**
 * Font standar PDF hanya mengenal aksara Latin (WinAnsi). Karakter di luar
 * itu diganti huruf dasarnya bila ada, supaya nama yang tidak lazim tidak
 * menggagalkan pembuatan dokumen.
 */
function printable(text: string, font: PDFFont) {
  const known = new Set(font.getCharacterSet());
  return Array.from(text.replace(/\s+/g, " ").trim())
    .map((char) => {
      if (known.has(char.codePointAt(0)!)) return char;
      const base = char.normalize("NFD").replace(/\p{M}/gu, "");
      return Array.from(base).every((c) => known.has(c.codePointAt(0)!))
        ? base
        : "?";
    })
    .join("");
}

/** Ukuran huruf terbesar antara `max` dan `min` yang membuat teks muat. */
function shrink(
  text: string,
  font: PDFFont,
  max: number,
  min: number,
  maxWidth: number,
) {
  let size = max;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth)
    size -= 0.5;
  return size;
}

/** Memangkas teks yang terlalu panjang agar tetap muat pada satu baris. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (
    value.length > 4 &&
    font.widthOfTextAtSize(`${value}…`, size) > maxWidth
  )
    value = value.slice(0, -1);
  return `${value.trimEnd()}…`;
}
