import type { FieldSpec } from "./entity-form";
import { DIFFICULTIES, serializeOptions } from "@/schemas/assessment";
import { labels } from "@/lib/utils";

const enums = (values: readonly string[]) =>
  values.map((value) => ({ value, label: labels[value] ?? value }));

const bool = (value: boolean | undefined, yes: string, no: string) => ({
  defaultValue: String(value ?? false),
  options: [
    { value: "false", label: no },
    { value: "true", label: yes },
  ],
});

/** `YYYY-MM-DDTHH:mm` waktu Jakarta — bentuk `<input type="datetime-local">`. */
function localInput(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
  return parts.replace(" ", "T");
}

export function assessmentFields(data?: {
  title: string;
  type: string;
  instructions: string;
  durationMinutes: number;
  passingGrade: number;
  maxAttempts: number;
  questionLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showResult: boolean;
  showAnswers: boolean;
  published: boolean;
  selection: string;
}): FieldSpec[] {
  return [
    {
      name: "title",
      label: "Judul penilaian",
      required: true,
      full: true,
      defaultValue: data?.title,
    },
    {
      name: "type",
      label: "Jenis",
      options: enums(["PRE_TEST", "QUIZ", "FINAL_EXAM"]),
      defaultValue: data?.type ?? "QUIZ",
    },
    {
      name: "durationMinutes",
      label: "Durasi (menit)",
      type: "number",
      required: true,
      min: 1,
      max: 600,
      defaultValue: data?.durationMinutes ?? 30,
    },
    {
      name: "passingGrade",
      label: "Nilai kelulusan",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      defaultValue: data?.passingGrade ?? 70,
    },
    {
      name: "maxAttempts",
      label: "Maksimal percobaan",
      type: "number",
      required: true,
      min: 1,
      max: 10,
      defaultValue: data?.maxAttempts ?? 1,
    },
    {
      name: "selection",
      label: "Sumber soal",
      defaultValue: data?.selection ?? "ALL",
      options: [
        { value: "ALL", label: "Seluruh bank soal course" },
        { value: "MANUAL", label: "Pilih soal sendiri" },
        { value: "RULES", label: "Sejumlah soal per topik" },
      ],
      help: "Daftar soal dan aturan per topik diatur setelah penilaian tersimpan.",
    },
    {
      name: "questionLimit",
      label: "Jumlah soal",
      type: "number",
      min: 0,
      max: 200,
      defaultValue: data?.questionLimit ?? 0,
      help: "Hanya berlaku untuk sumber “Seluruh bank soal”. Isi 0 untuk memakai semuanya.",
    },
    {
      name: "startsAt",
      label: "Dibuka (WIB)",
      type: "datetime-local",
      defaultValue: localInput(data?.startsAt),
      help: "Kosongkan bila dapat dikerjakan kapan saja.",
    },
    {
      name: "endsAt",
      label: "Ditutup (WIB)",
      type: "datetime-local",
      defaultValue: localInput(data?.endsAt),
    },
    {
      name: "randomizeQuestions",
      label: "Acak urutan soal",
      ...bool(data?.randomizeQuestions, "Ya", "Tidak"),
    },
    {
      name: "randomizeOptions",
      label: "Acak urutan pilihan",
      ...bool(data?.randomizeOptions, "Ya", "Tidak"),
    },
    {
      name: "showResult",
      label: "Tampilkan nilai ke peserta",
      ...bool(data?.showResult, "Ya", "Tidak"),
    },
    {
      name: "showAnswers",
      label: "Tampilkan kunci jawaban",
      ...bool(data?.showAnswers, "Ya", "Tidak"),
    },
    {
      name: "published",
      label: "Status",
      ...bool(data?.published, "Terbit untuk peserta", "Draft"),
    },
    {
      name: "instructions",
      label: "Instruksi pengerjaan",
      type: "textarea",
      full: true,
      defaultValue: data?.instructions,
    },
  ];
}

export function assignmentFields(data?: {
  title: string;
  instructions: string;
  dueAt: Date;
  maxScore: number;
  required: boolean;
  published: boolean;
}): FieldSpec[] {
  return [
    {
      name: "title",
      label: "Judul tugas",
      required: true,
      full: true,
      defaultValue: data?.title,
    },
    {
      name: "dueAt",
      label: "Batas waktu (WIB)",
      type: "datetime-local",
      required: true,
      defaultValue: localInput(data?.dueAt),
    },
    {
      name: "maxScore",
      label: "Nilai maksimum",
      type: "number",
      required: true,
      min: 1,
      max: 1000,
      defaultValue: data?.maxScore ?? 100,
    },
    {
      name: "required",
      label: "Kewajiban",
      ...bool(data?.required ?? true, "Wajib", "Opsional"),
    },
    {
      name: "published",
      label: "Status",
      ...bool(data?.published, "Terbit untuk peserta", "Draft"),
    },
    {
      name: "instructions",
      label: "Instruksi",
      type: "textarea",
      required: true,
      full: true,
      defaultValue: data?.instructions,
      help: "Jelaskan keluaran yang diharapkan dan cara membagikan berkasnya.",
    },
  ];
}

export function resourceFields(): FieldSpec[] {
  return [
    { name: "title", label: "Judul materi", required: true, full: true },
    {
      name: "url",
      label: "Tautan",
      type: "url",
      required: true,
      full: true,
      placeholder: "https://",
      help: "Tautan slide, template, atau dokumen pendukung. Akses tautan mengikuti pengaturan penyedianya.",
    },
    {
      name: "description",
      label: "Keterangan",
      type: "textarea",
      full: true,
    },
  ];
}

export function reviewFields(
  maxScore: number,
  current?: {
    score: number | null;
    feedback: string | null;
    status: string;
  },
): FieldSpec[] {
  return [
    {
      name: "status",
      label: "Hasil pemeriksaan",
      required: true,
      defaultValue:
        current?.status === "SUBMITTED" ? "REVIEWED" : current?.status,
      options: [
        { value: "REVIEWED", label: "Dinilai" },
        { value: "COMPLETED", label: "Selesai" },
        { value: "REVISION_REQUIRED", label: "Perlu revisi" },
      ],
    },
    {
      name: "score",
      label: `Nilai (0–${maxScore})`,
      type: "number",
      min: 0,
      max: maxScore,
      defaultValue: current?.score ?? undefined,
    },
    {
      name: "feedback",
      label: "Umpan balik",
      type: "textarea",
      full: true,
      defaultValue: current?.feedback ?? "",
    },
  ];
}

export function questionFields(
  courses: { id: string; title: string }[],
  data?: {
    courseId: string;
    topic: string;
    difficulty: string;
    type: string;
    text: string;
    points: number;
    explanation: string | null;
    correctText: string | null;
    options: { text: string; correct: boolean }[];
  },
): FieldSpec[] {
  return [
    {
      name: "courseId",
      label: "Course",
      required: true,
      defaultValue: data?.courseId,
      options: [
        { value: "", label: "Pilih course" },
        ...courses.map((course) => ({
          value: course.id,
          label: course.title,
        })),
      ],
    },
    {
      name: "topic",
      label: "Topik",
      required: true,
      defaultValue: data?.topic,
      placeholder: "Klausul 4 — Konteks organisasi",
    },
    {
      name: "type",
      label: "Jenis soal",
      options: enums([
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "TRUE_FALSE",
        "SHORT_TEXT",
        "ESSAY",
      ]),
      defaultValue: data?.type ?? "SINGLE_CHOICE",
    },
    {
      name: "difficulty",
      label: "Tingkat kesulitan",
      options: enums(DIFFICULTIES),
      defaultValue: data?.difficulty ?? "MEDIUM",
    },
    {
      name: "points",
      label: "Bobot nilai",
      type: "number",
      required: true,
      min: 1,
      max: 100,
      defaultValue: data?.points ?? 1,
    },
    {
      name: "text",
      label: "Pertanyaan",
      type: "textarea",
      required: true,
      full: true,
      defaultValue: data?.text,
    },
    {
      name: "options",
      label: "Pilihan jawaban",
      type: "textarea",
      full: true,
      defaultValue: data ? serializeOptions(data.options) : "",
      help: "Satu pilihan per baris. Awali jawaban benar dengan tanda bintang, contoh: *Confidentiality, Integrity, Availability",
    },
    {
      name: "correctText",
      label: "Kunci jawaban isian singkat",
      full: true,
      defaultValue: data?.correctText ?? "",
      help: "Pisahkan beberapa jawaban yang diterima dengan tanda |. Huruf besar-kecil dan spasi berlebih diabaikan.",
    },
    {
      name: "explanation",
      label: "Pembahasan",
      type: "textarea",
      full: true,
      defaultValue: data?.explanation ?? "",
    },
  ];
}

export function revokeFields(): FieldSpec[] {
  return [
    {
      name: "reason",
      label: "Alasan pencabutan",
      type: "textarea",
      required: true,
      full: true,
      help: "Alasan tersimpan pada catatan audit dan tidak ditampilkan di halaman verifikasi publik.",
    },
  ];
}
