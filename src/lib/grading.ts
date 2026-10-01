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
  requiresReason?: boolean;
  parentId?: string | null;
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
    requiresReason: question.requiresReason,
    parentId: question.parentId,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
  }));
}

/** Menilai satu soal objektif. Semua selain SINGLE_CHOICE dan TRUE_FALSE mengembalikan null: menunggu trainer. */
export function gradeAnswer(
  question: SnapshotQuestion,
  answer: unknown,
): number | null {
  let realAnswer = answer;
  if (
    answer &&
    typeof answer === "object" &&
    !Array.isArray(answer) &&
    "answer" in answer
  ) {
    realAnswer = (answer as { answer: unknown }).answer;
  }

  if (
    question.type !== "SINGLE_CHOICE" &&
    question.type !== "TRUE_FALSE"
  ) {
    return null;
  }

  const correct = question.options
    .filter((option) => option.correct)
    .map((option) => option.id)
    .sort();

  const given = (Array.isArray(realAnswer) ? realAnswer : [realAnswer])
    .filter((value): value is string => typeof value === "string")
    .sort();


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
