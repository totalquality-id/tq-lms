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

/**
 * Teks studi kasus hanya pengantar bagi sub-soalnya: tidak dijawab, tidak
 * bernilai, dan tidak dihitung sebagai soal.
 */
export function isAnswerable(question: { type: QuestionType }) {
  return question.type !== "CASE_STUDY";
}

/** Jenis yang selalu diperiksa trainer; jenis lain dinilai otomatis. */
export function isManual(question: { type: QuestionType }) {
  return question.type === "ESSAY";
}

/**
 * Label soal yang sama dengan bank soal: soal utama bernomor 1, 2, …; studi
 * kasus memakai nomornya sendiri dan sub-soalnya 1.1, 1.2, ….
 */
export function questionNumbers(
  questions: { id: string; parentId?: string | null }[],
) {
  const labels = new Map<string, string>();
  const childCount = new Map<string, number>();
  let top = 0;
  for (const question of questions) {
    const parent = question.parentId ? labels.get(question.parentId) : undefined;
    if (question.parentId && parent) {
      const index = (childCount.get(question.parentId) ?? 0) + 1;
      childCount.set(question.parentId, index);
      labels.set(question.id, `${parent}.${index}`);
    } else {
      top += 1;
      labels.set(question.id, String(top));
    }
  }
  return labels;
}

/** Jawaban tersimpan dapat berupa nilai polos atau { answer, reason }. */
export function answerParts(value: unknown): {
  answer: unknown;
  reason: string | null;
} {
  if (value && typeof value === "object" && !Array.isArray(value) && "answer" in value) {
    const { answer, reason } = value as { answer: unknown; reason?: unknown };
    return { answer, reason: typeof reason === "string" && reason.trim() ? reason : null };
  }
  return { answer: value, reason: null };
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Menilai satu soal secara otomatis. Esai mengembalikan null: menunggu trainer.
 * Nilai otomatis tetap dapat dikoreksi trainer dari halaman detail percobaan.
 */
export function gradeAnswer(
  question: SnapshotQuestion,
  answer: unknown,
): number | null {
  if (!isAnswerable(question)) return 0;
  if (isManual(question)) return null;

  const given = answerParts(answer).answer;

  if (question.type === "SHORT_TEXT") {
    if (typeof given !== "string" || !question.correctText) return 0;
    const accepted = question.correctText.split("|").map(normalize);
    return accepted.includes(normalize(given)) ? question.points : 0;
  }

  const correct = question.options
    .filter((option) => option.correct)
    .map((option) => option.id)
    .sort();
  const chosen = (Array.isArray(given) ? given : [given])
    .filter((value): value is string => typeof value === "string")
    .sort();

  if (question.type === "MULTIPLE_CHOICE")
    // Pilihan ganda dinilai utuh: satu pilihan keliru membatalkan nilai soal,
    // sehingga menandai semua pilihan tidak pernah menguntungkan.
    return chosen.length === correct.length &&
      chosen.every((value, index) => value === correct[index])
      ? question.points
      : 0;

  return chosen.length === 1 && correct.includes(chosen[0]) ? question.points : 0;
}

/**
 * Nilai akhir satu percobaan dari nilai per soal.
 *
 * `scores` memetakan id soal ke nilai jawabannya: `null` berarti jawaban ada
 * tetapi belum diperiksa, dan soal tanpa entri berarti tidak dijawab — bernilai
 * nol, bukan menunggu. Soal kosong tidak pernah muncul di antrean trainer, jadi
 * menganggapnya menunggu akan membuat nilai percobaan kosong selamanya.
 */
export function attemptScore(
  snapshot: SnapshotQuestion[],
  scores: Map<string, number | null>,
): { pending: boolean; score: number } {
  let total = 0;
  let earned = 0;
  let pending = false;
  for (const question of snapshot) {
    if (!isAnswerable(question)) continue;
    total += question.points;
    if (!scores.has(question.id)) continue;
    const value = scores.get(question.id);
    if (value === null || value === undefined) pending = true;
    else earned += value;
  }
  return { pending, score: total ? (earned / total) * 100 : 0 };
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
