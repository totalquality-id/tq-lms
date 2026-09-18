import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

import type { CertificateSnapshot } from "@/services/certificate";
import { certificatePeriod } from "@/services/certificate";

const BRAND = rgb(0x2b / 255, 0x55 / 255, 0x89 / 255);
const ACCENT = rgb(0xfa / 255, 0xcc / 255, 0x01 / 255);
const INK = rgb(0x16 / 255, 0x1c / 255, 0x24 / 255);
const MUTED = rgb(0x4c / 255, 0x58 / 255, 0x67 / 255);

/** A4 melintang, satuan titik. */
const WIDTH = 841.89;
const HEIGHT = 595.28;

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
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Sertifikat ${number}`);
  pdf.setAuthor("PT Total Quality Indonesia");
  pdf.setSubject(snapshot.course);
  pdf.setProducer("Total Quality Learning");

  const page = pdf.addPage([WIDTH, HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Bingkai: satu garis tipis biru dan satu aksen kuning pendek di kiri atas.
  page.drawRectangle({
    x: 28,
    y: 28,
    width: WIDTH - 56,
    height: HEIGHT - 56,
    borderColor: BRAND,
    borderWidth: 1.2,
  });
  page.drawRectangle({
    x: 28,
    y: HEIGHT - 32,
    width: 120,
    height: 4,
    color: ACCENT,
  });

  const center = (
    text: string,
    y: number,
    size: number,
    font = regular,
    color = INK,
  ) => {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (WIDTH - width) / 2,
      y,
      size,
      font,
      color,
    });
  };

  center("PT TOTAL QUALITY INDONESIA", HEIGHT - 92, 11, bold, BRAND);
  center("SERTIFIKAT PELATIHAN", HEIGHT - 128, 26, bold, INK);
  center("Certificate of Training", HEIGHT - 148, 11, italic, MUTED);

  center("Diberikan kepada", HEIGHT - 196, 11, regular, MUTED);
  center(
    fit(snapshot.participant, bold, 28, WIDTH - 200),
    HEIGHT - 232,
    28,
    bold,
    BRAND,
  );

  if (snapshot.organization)
    center(
      fit(snapshot.organization, regular, 12, WIDTH - 200),
      HEIGHT - 254,
      12,
      regular,
      MUTED,
    );

  center(
    "atas keikutsertaan dan kelulusan pada pelatihan",
    HEIGHT - 290,
    11,
    regular,
    MUTED,
  );
  center(
    fit(snapshot.course, bold, 17, WIDTH - 160),
    HEIGHT - 318,
    17,
    bold,
    INK,
  );
  center(
    `${certificatePeriod(snapshot)}  ·  ${snapshot.durationHours} jam pelatihan`,
    HEIGHT - 340,
    11,
    regular,
    MUTED,
  );

  // Blok keterangan di kiri bawah: nomor, penerbitan, trainer.
  const left = 70;
  let y = 150;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: left, y, size: 8, font: bold, color: MUTED });
    page.drawText(fit(value, regular, 11, 330), {
      x: left,
      y: y - 14,
      size: 11,
      font: regular,
      color: INK,
    });
    y -= 36;
  };

  line("NOMOR SERTIFIKAT", number);
  line(
    "TRAINER",
    snapshot.trainers.length ? snapshot.trainers.join(", ") : "—",
  );

  page.drawText(
    "Keaslian sertifikat dapat diperiksa dengan memindai kode di samping.",
    { x: left, y: 74, size: 8, font: regular, color: MUTED },
  );
  page.drawText(fit(verifyUrl, regular, 8, 330), {
    x: left,
    y: 62,
    size: 8,
    font: regular,
    color: BRAND,
  });

  // Kode QR di kanan bawah, berdampingan dengan ruang tanda tangan.
  const qrPng = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    margin: 0,
    width: 300,
    color: { dark: "#2B5589", light: "#FFFFFF" },
  });
  const qr = await pdf.embedPng(qrPng);
  page.drawImage(qr, { x: WIDTH - 168, y: 62, width: 96, height: 96 });

  const signX = WIDTH - 420;
  page.drawText("PT Total Quality Indonesia", {
    x: signX,
    y: 150,
    size: 10,
    font: regular,
    color: MUTED,
  });
  page.drawLine({
    start: { x: signX, y: 82 },
    end: { x: signX + 190, y: 82 },
    thickness: 0.8,
    color: MUTED,
  });
  page.drawText("Training Director", {
    x: signX,
    y: 68,
    size: 9,
    font: regular,
    color: MUTED,
  });

  return pdf.save();
}

/** Memangkas teks yang terlalu panjang agar tetap muat pada satu baris. */
function fit(
  text: string,
  font: { widthOfTextAtSize: (value: string, size: number) => number },
  size: number,
  maxWidth: number,
) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (
    value.length > 4 &&
    font.widthOfTextAtSize(`${value}…`, size) > maxWidth
  )
    value = value.slice(0, -1);
  return `${value}…`;
}
