import type { QuestionType } from "@prisma/client";

/**
 * Salinan soal yang dibekukan saat percobaan dimulai. Soal yang diubah atau
 * dihapus setelahnya tidak boleh mengubah ujian yang sedang berjalan maupun
 * hasil yang sudah tercatat, jadi teks dan kunci jawabannya disimpan utuh di
 * dalam percobaan itu sendiri.
 */
export type SnapshotQuestion = {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  explanation: string | null;
  options: { id: string; text: string; correct: boolean }[];
  correctText: string | null;
};

/** Bentuk yang dikirim ke peramban: kunci jawaban dibuang. */
export type VisibleQuestion = Omit<
  SnapshotQuestion,
  "options" | "correctText" | "explanation"
> & {
  options: { id: string; text: string }[];
};

export function visibleQuestions(
  snapshot: SnapshotQuestion[],
): VisibleQuestion[] {
  return snapshot.map((question) => ({
    id: question.id,
    type: question.type,
    text: question.text,
    points: question.points,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
  }));
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Menilai satu soal objektif. Esai mengembalikan null: menunggu trainer. */
export function gradeAnswer(
  question: SnapshotQuestion,
  answer: unknown,
): number | null {
  if (question.type === "ESSAY") return null;

  if (question.type === "SHORT_TEXT") {
    if (typeof answer !== "string" || !question.correctText) return 0;
    const accepted = question.correctText
      .split("|")
      .map((option) => normalize(option));
    return accepted.includes(normalize(answer)) ? question.points : 0;
  }

  const correct = question.options
    .filter((option) => option.correct)
    .map((option) => option.id)
    .sort();

  const given = (Array.isArray(answer) ? answer : [answer])
    .filter((value): value is string => typeof value === "string")
    .sort();

  if (question.type === "MULTIPLE_CHOICE")
    // Pilihan ganda dinilai utuh: satu pilihan keliru membatalkan nilai soal,
    // sehingga menandai semua pilihan tidak pernah menguntungkan.
    return given.length === correct.length &&
      given.every((value, index) => value === correct[index])
      ? question.points
      : 0;

  return given.length === 1 && correct.includes(given[0]) ? question.points : 0;
}

/** Nilai terbaik peserta pada satu penilaian, atau null bila belum ada. */
export function bestScore(
  attempts: { submittedAt: Date | null; score: number | null }[],
) {
  const scores = attempts
    .filter((attempt) => attempt.submittedAt && attempt.score !== null)
    .map((attempt) => attempt.score as number);
  return scores.length ? Math.max(...scores) : null;
}
