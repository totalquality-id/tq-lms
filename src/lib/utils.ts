import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Seluruh tanggal ditampilkan dalam zona Jakarta, apa pun zona peramban
 * pembaca, supaya jadwal pelatihan yang ditulis panitia tidak bergeser satu
 * hari ketika dibuka dari perangkat dengan zona berbeda.
 */
export const TZ = "Asia/Jakarta";

export function date(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(value));
}

export function dateLong(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(value));
}

export function dateTime(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(value));
}

/** `YYYY-MM-DD` di zona Jakarta — bentuk yang diterima `<input type="date">`. */
export function dateInput(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** Rentang tanggal yang dipadatkan: "1–3 Jul 2026", bukan dua tanggal penuh. */
export function dateRange(start: Date | string, end: Date | string) {
  const from = new Date(start);
  const to = new Date(end);
  if (dateInput(from) === dateInput(to)) return dateLong(from);
  const sameMonth =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
    }).format(from) ===
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
    }).format(to);
  if (!sameMonth) return `${date(from)} – ${date(to)}`;
  const day = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    timeZone: TZ,
  }).format(from);
  return `${day}–${date(to)}`;
}

/**
 * Hari kalender untuk kolom `@db.Date`.
 *
 * PostgreSQL menyimpan DATE tanpa zona waktu, dan Prisma memakai bagian UTC
 * dari nilai yang dikirim. Menulis tengah malam Jakarta (`T00:00:00+07:00`)
 * karena itu tersimpan sebagai hari sebelumnya — presensi "Hari 1" berakhir
 * tercatat pada tanggal yang salah. Seluruh tanggal kalender di aplikasi ini
 * karenanya dibentuk dan dibaca pada tengah malam UTC.
 */
export function calendarDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Kebalikan dari calendarDate: `YYYY-MM-DD` dari nilai kolom tanggal. */
export function calendarKey(value: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** Setiap hari kalender dalam rentang jadwal, sebagai hari kalender UTC. */
export function daysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let cursor = calendarDate(dateInput(start));
  const last = calendarDate(dateInput(end));
  // Batas wajar supaya data yang rusak tidak membuat halaman menggantung.
  while (cursor <= last && days.length < 90) {
    days.push(cursor);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return days;
}

export function initials(name: string) {
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

export function minutes(value: number) {
  if (value < 60) return `${value} menit`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

export const labels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  TRAINER: "Trainer",
  PARTICIPANT: "Peserta",
  CORPORATE_PIC: "PIC Perusahaan",

  DRAFT: "Draft",
  OPEN: "Pendaftaran dibuka",
  ONGOING: "Berlangsung",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",

  INVITED: "Diundang",
  ENROLLED: "Terdaftar",
  IN_PROGRESS: "Sedang belajar",

  OFFLINE: "Tatap muka",
  ONLINE: "Online",
  HYBRID: "Hybrid",

  TEXT: "Artikel",
  PDF: "PDF",
  VIDEO: "Video",
  IMAGE: "Gambar",
  FILE: "File",
  EXTERNAL_LINK: "Tautan",

  PRE_TEST: "Pre-Test",
  QUIZ: "Kuis",
  FINAL_EXAM: "Ujian akhir",

  SINGLE_CHOICE: "Pilihan tunggal",
  MULTIPLE_CHOICE: "Pilihan ganda",
  TRUE_FALSE: "Benar / Salah",
  SHORT_TEXT: "Isian singkat",
  ESSAY: "Esai",

  EASY: "Mudah",
  MEDIUM: "Sedang",
  HARD: "Sulit",

  PRESENT: "Hadir",
  LATE: "Terlambat",
  EXCUSED: "Izin",
  ABSENT: "Tidak hadir",

  NOT_SUBMITTED: "Belum dikumpulkan",
  SUBMITTED: "Dikumpulkan",
  REVIEWED: "Dinilai",
  REVISION_REQUIRED: "Perlu revisi",

  ISSUED: "Diterbitkan",
  REVOKED: "Dicabut",

  PASSED: "Lulus",
  FAILED: "Belum lulus",
  PENDING: "Menunggu",
  PUBLISHED: "Dipublikasikan",
};
