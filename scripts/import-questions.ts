/**
 * Impor massal soal pilihan tunggal ke bank soal satu course.
 *
 * Pemakaian (dari akar proyek):
 *   npm run questions:import -- soal-41-100.csv            # cek saja, tidak menulis
 *   npm run questions:import -- soal-41-100.csv --apply    # tulis ke database
 *
 * Secara bawaan skrip hanya memeriksa (dry-run). Setiap baris divalidasi dengan
 * questionSchema yang sama dengan form admin, sehingga soal yang lolos di sini
 * juga lolos di aplikasi. Penulisan dilakukan atomik: bila satu soal gagal,
 * tidak ada satu pun yang masuk. Soal dengan teks identik yang sudah ada di
 * course dilewati, jadi aman dijalankan ulang.
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import { questionSchema } from "../src/schemas/assessment";

// ── Pengaturan tetap untuk seluruh soal pada berkas ini ─────────────────────
export const COURSE_ID = "cmudlgq690000js04xzc74mah";
export const TOPIC = "Practice";
export const DIFFICULTY = "MEDIUM";
export const POINTS = 1;
export const TYPE = "SINGLE_CHOICE";

const LETTERS = ["A", "B", "C", "D", "E"] as const;

/** Parser CSV minimal: kutip ganda, baris baru di dalam sel, BOM, ; atau , */
export function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

export type PreparedQuestion = {
  line: number;
  no: string;
  data: ReturnType<typeof questionSchema.parse>;
};

/**
 * Kolom (judul baris pertama, tanpa membedakan huruf besar/kecil):
 *   no ; pertanyaan ; a ; b ; c ; d ; e(opsional) ; kunci ; pembahasan(opsional)
 */
export function prepare(rows: string[][]) {
  const errors: string[] = [];
  const items: PreparedQuestion[] = [];
  if (rows.length < 2) return { items, errors: ["Berkas kosong atau tanpa baris soal."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) =>
    header.findIndex((h) => names.includes(h));
  const idx = {
    no: col("no", "nomor"),
    text: col("pertanyaan", "soal", "text"),
    key: col("kunci", "jawaban", "key"),
    explanation: col("pembahasan", "penjelasan", "explanation"),
    options: LETTERS.map((letter) => col(letter.toLowerCase())),
  };
  if (idx.text < 0 || idx.key < 0 || idx.options[0] < 0 || idx.options[1] < 0)
    return {
      items,
      errors: [
        "Judul kolom wajib: no;pertanyaan;a;b;c;d;kunci (pembahasan opsional).",
      ],
    };

  const seen = new Set<string>();
  rows.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (index: number) => (index < 0 ? "" : (cells[index] ?? "").trim());
    const no = get(idx.no) || `baris ${line}`;
    const label = `Soal ${no} (baris ${line})`;

    const options = idx.options
      .map((index, position) => ({ letter: LETTERS[position], text: get(index) }))
      .filter((option) => option.text !== "");
    const key = get(idx.key).toUpperCase();
    const keyed = options.find((option) => option.letter === key);
    if (!keyed) {
      errors.push(
        `${label}: kunci "${get(idx.key)}" tidak menunjuk ke pilihan yang terisi.`,
      );
      return;
    }

    const parsed = questionSchema.safeParse({
      courseId: COURSE_ID,
      topic: TOPIC,
      difficulty: DIFFICULTY,
      type: TYPE,
      points: POINTS,
      text: get(idx.text),
      explanation: get(idx.explanation),
      optionItems: options.map((option) => ({
        text: option.text,
        correct: option.letter === key,
      })),
    });
    if (!parsed.success) {
      errors.push(
        `${label}: ${parsed.error.issues.map((issue) => issue.message).join(" ")}`,
      );
      return;
    }
    const fingerprint = parsed.data.text.trim().toLowerCase();
    if (seen.has(fingerprint)) {
      errors.push(`${label}: teks soal sama dengan baris sebelumnya di berkas ini.`);
      return;
    }
    seen.add(fingerprint);
    items.push({ line, no, data: parsed.data });
  });
  return { items, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  const apply = args.includes("--apply");
  if (!file) throw new Error("Sebutkan berkas CSV. Contoh: soal-41-100.csv");

  const { items, errors } = prepare(parseCsv(readFileSync(file, "utf8")));
  if (errors.length) {
    console.error(`Ditemukan ${errors.length} masalah. Tidak ada yang ditulis:\n`);
    for (const message of errors) console.error(` - ${message}`);
    process.exitCode = 1;
    return;
  }

  const db = new PrismaClient();
  try {
    const course = await db.course.findFirst({
      where: { id: COURSE_ID, deletedAt: null },
      select: { id: true, title: true },
    });
    if (!course) throw new Error(`Course ${COURSE_ID} tidak ditemukan atau sudah dihapus.`);

    const existing = await db.question.findMany({
      where: { courseId: COURSE_ID, deletedAt: null },
      select: { text: true },
    });
    const have = new Set(existing.map((q) => q.text.trim().toLowerCase()));
    const fresh = items.filter((item) => !have.has(item.data.text.toLowerCase()));
    const skipped = items.length - fresh.length;

    console.log(`Course  : ${course.title}`);
    console.log(`Bank soal saat ini : ${existing.length} soal aktif`);
    console.log(`Dalam berkas       : ${items.length} soal valid`);
    console.log(`Sudah ada (dilewati): ${skipped}`);
    console.log(`Akan ditambahkan   : ${fresh.length}`);

    if (!apply) {
      console.log("\nDry-run: belum ada yang ditulis. Tambahkan --apply untuk menyimpan.");
      return;
    }
    if (!fresh.length) {
      console.log("\nTidak ada soal baru untuk ditambahkan.");
      return;
    }

    // Satu batch atomik, diurutkan sesuai berkas.
    await db.$transaction(
      fresh.map(({ data }) =>
        db.question.create({
          data: {
            courseId: data.courseId,
            topic: data.topic,
            difficulty: data.difficulty,
            type: data.type,
            text: data.text,
            points: data.points,
            explanation: data.explanation || null,
            correctText: null,
            options: {
              create: (data.optionItems ?? []).map((option, index) => ({
                text: option.text,
                correct: option.correct,
                position: index + 1,
              })),
            },
          },
        }),
      ),
    );
    const total = await db.question.count({
      where: { courseId: COURSE_ID, deletedAt: null },
    });
    console.log(`\nSelesai: ${fresh.length} soal ditambahkan. Total bank soal: ${total}.`);
  } finally {
    await db.$disconnect();
  }
}

// Hanya berjalan saat dieksekusi langsung, bukan saat diimpor oleh test.
if (process.argv[1]?.endsWith("import-questions.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
