import { AssessmentType, QuestionType, SelectionMode } from "@prisma/client";
import { z } from "zod";

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

/** Butir jawaban satu soal, sebagaimana disimpan pada AssessmentAnswer.answer. */
export const answerValue = z.union([
  z.string().max(20000),
  z.array(z.string().max(200)).max(20),
]);

export const questionSchema = z
  .object({
    courseId: z.string().min(1, "Pilih course."),
    topic: z.string().trim().min(2, "Isi topik minimal 2 karakter.").max(200),
    difficulty: z.enum(DIFFICULTIES),
    type: z.enum(QuestionType),
    text: z
      .string()
      .trim()
      .min(5, "Tuliskan pertanyaan minimal 5 karakter.")
      .max(5000),
    points: z.coerce.number().int().min(1).max(100),
    explanation: z.string().trim().max(2000).optional().default(""),
    /**
     * Format teks untuk kompatibilitas dengan formulir lama. Form visual
     * memakai optionItems agar isi jawaban dan penanda kunci terpisah.
     */
    options: z.string().max(5000).optional().default(""),
    // Form visual mengirim array JSON agar tanda * pada teks tetap literal.
    optionItems: z.preprocess(
      (value) => {
        if (typeof value !== "string") return value;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      },
      z
        .array(
          z.object({
            text: z
              .string()
              .trim()
              .min(1, "Isi setiap pilihan jawaban.")
              .max(500),
            correct: z.boolean(),
          }),
        )
        .min(2, "Tambahkan minimal dua pilihan jawaban.")
        .max(20)
        .optional(),
    ),
    correctText: z.string().trim().max(500).optional().default(""),
  })
  .superRefine((value, ctx) => {
    const choice =
      value.type === "SINGLE_CHOICE" ||
      value.type === "MULTIPLE_CHOICE" ||
      value.type === "TRUE_FALSE";

    if (choice) {
      const lines = value.optionItems ?? parseOptions(value.options);
      if (lines.length < 2)
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Tuliskan minimal dua pilihan, satu per baris.",
        });
      const correct = lines.filter((line) => line.correct).length;
      if (correct === 0)
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: value.optionItems
            ? "Pilih kunci jawaban yang benar."
            : "Tandai jawaban benar dengan * di awal baris.",
        });
      if (value.type !== "MULTIPLE_CHOICE" && correct > 1)
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Jenis soal ini hanya boleh memiliki satu jawaban benar.",
        });
    }

    if (value.type === "SHORT_TEXT" && !value.correctText)
      ctx.addIssue({
        code: "custom",
        path: ["correctText"],
        message: "Isi kunci jawaban untuk isian singkat.",
      });
  });

export type QuestionInput = z.infer<typeof questionSchema>;

export function parseOptions(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => ({
      correct: line.startsWith("*"),
      text: line.replace(/^\*\s*/, "").slice(0, 500),
    }))
    .filter((option) => option.text.length > 0);
}

export function serializeOptions(
  options: { text: string; correct: boolean }[],
) {
  return options
    .map((option) => (option.correct ? `*${option.text}` : option.text))
    .join("\n");
}

export const assessmentSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    type: z.enum(AssessmentType),
    instructions: z.string().trim().max(5000).optional().default(""),
    durationMinutes: z.coerce.number().int().min(1).max(600),
    passingGrade: z.coerce.number().int().min(0).max(100),
    maxAttempts: z.coerce.number().int().min(1).max(10),
    questionLimit: z.coerce
      .number()
      .int()
      .min(0)
      .max(200)
      .optional()
      .default(0),
    startsAt: z.string().optional().default(""),
    endsAt: z.string().optional().default(""),
    randomizeQuestions: z
      .enum(["true", "false"])
      .transform((v) => v === "true"),
    randomizeOptions: z.enum(["true", "false"]).transform((v) => v === "true"),
    showResult: z.enum(["true", "false"]).transform((v) => v === "true"),
    showAnswers: z.enum(["true", "false"]).transform((v) => v === "true"),
    published: z.enum(["true", "false"]).transform((v) => v === "true"),
    selection: z.enum(SelectionMode),
  })
  .refine(
    (value) =>
      !value.startsAt || !value.endsAt || value.endsAt > value.startsAt,
    { path: ["endsAt"], message: "Waktu tutup harus setelah waktu buka." },
  );

/**
 * Aturan per topik dikirim sebagai pasangan `topic[]` dan `count[]` dari
 * formulir. Topik yang jumlahnya nol berarti tidak dipakai, bukan galat —
 * formulirnya menampilkan seluruh topik di bank soal sekaligus.
 */
export const selectionRulesSchema = z
  .object({
    topic: z.union([z.string(), z.array(z.string())]),
    count: z.union([z.string(), z.array(z.string())]),
  })
  .transform(({ topic, count }) => {
    const topics = Array.isArray(topic) ? topic : [topic];
    const counts = Array.isArray(count) ? count : [count];
    return topics
      .map((value, index) => ({
        topic: value.trim(),
        count: Number(counts[index] ?? 0),
      }))
      .filter((rule) => rule.topic.length > 0);
  })
  .superRefine((rules, ctx) => {
    for (const rule of rules)
      if (!Number.isInteger(rule.count) || rule.count < 0 || rule.count > 200)
        ctx.addIssue({
          code: "custom",
          path: ["count"],
          message: `Jumlah soal untuk "${rule.topic}" harus antara 0 dan 200.`,
        });

    const total = rules.reduce((sum, rule) => sum + (rule.count || 0), 0);
    if (total === 0)
      ctx.addIssue({
        code: "custom",
        path: ["count"],
        message: "Tentukan jumlah soal untuk setidaknya satu topik.",
      });
    if (total > 200)
      ctx.addIssue({
        code: "custom",
        path: ["count"],
        message: "Total soal melebihi 200.",
      });
  });

/** Jawaban yang dikirim peserta: peta id soal ke satu nilai atau daftar nilai. */
export const submissionSchema = z.record(z.string().max(64), answerValue);
