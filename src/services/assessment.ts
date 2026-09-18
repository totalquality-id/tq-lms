import "server-only";

import { notFound } from "next/navigation";
import { Prisma, type QuestionType } from "@prisma/client";

import { db } from "@/lib/db";
import { bestScore, gradeAnswer, type SnapshotQuestion } from "@/lib/grading";
import {
  parseRules,
  selectQuestions,
  shuffleInPlace as shuffle,
} from "@/lib/question-selection";
import { currentUser } from "./access";
import { notify } from "./notification";

// Penilaian objektif adalah logika murni dan tinggal di lib, agar aturannya
// dapat diuji tanpa basis data.
export { bestScore, gradeAnswer, visibleQuestions } from "@/lib/grading";
export type { SnapshotQuestion, VisibleQuestion } from "@/lib/grading";
import { myEnrollment } from "./learning";
import { submissionSchema } from "@/schemas/assessment";

/**
 * Menyusun paket soal untuk satu percobaan.
 *
 * Aturan pemilihannya murni dan tinggal di lib; yang dikerjakan di sini hanya
 * membaca bank soal dan membekukan hasilnya. Pengacakan dan pembatasan jumlah
 * dijalankan di server, sehingga dua peserta benar-benar memperoleh paket yang
 * berbeda dan tidak ada yang dapat diatur dari peramban.
 */
async function pickQuestions(
  tx: Prisma.TransactionClient,
  assessmentId: string,
): Promise<SnapshotQuestion[]> {
  const assessment = await tx.assessment.findUniqueOrThrow({
    where: { id: assessmentId },
    include: {
      batch: { select: { courseId: true } },
      questions: {
        orderBy: { position: "asc" },
        include: {
          question: { include: { options: { orderBy: { position: "asc" } } } },
        },
      },
    },
  });

  const manual = assessment.questions
    .map((link) => link.question)
    .filter((question) => !question.deletedAt);

  // Bank soal hanya dibaca bila modenya memerlukannya.
  const bank =
    assessment.selection === "MANUAL"
      ? []
      : await tx.question.findMany({
          where: { courseId: assessment.batch.courseId, deletedAt: null },
          include: { options: { orderBy: { position: "asc" } } },
          orderBy: { id: "asc" },
        });

  const { questions } = selectQuestions(
    {
      mode: assessment.selection,
      rules: parseRules(assessment.selectionRules),
      limit: assessment.questionLimit,
      randomize: assessment.randomizeQuestions,
    },
    { manual, bank },
  );

  if (questions.length === 0)
    throw new Error(
      assessment.selection === "MANUAL"
        ? "Daftar soal penilaian ini masih kosong. Hubungi trainer Anda."
        : "Bank soal untuk penilaian ini masih kosong. Hubungi trainer Anda.",
    );

  return questions.map((question) => ({
    id: question.id,
    type: question.type,
    text: question.text,
    points: question.points,
    explanation: question.explanation,
    correctText: question.correctText,
    options: (assessment.randomizeOptions
      ? shuffle(question.options)
      : question.options
    ).map((option) => ({
      id: option.id,
      text: option.text,
      correct: option.correct,
    })),
  }));
}

export async function assessmentForParticipant(
  batchId: string,
  assessmentId: string,
) {
  const enrollment = await myEnrollment(batchId);
  const assessment = enrollment.batch.assessments.find(
    (item) => item.id === assessmentId,
  );
  if (!assessment) notFound();
  const attempts = enrollment.attempts.filter(
    (attempt) => attempt.assessmentId === assessmentId,
  );
  return { enrollment, assessment, attempts };
}

export type AttemptWindow = { ok: true } | { ok: false; reason: string };

export function attemptWindow(
  assessment: { startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): AttemptWindow {
  if (assessment.startsAt && now < assessment.startsAt)
    return { ok: false, reason: "Penilaian belum dibuka." };
  if (assessment.endsAt && now > assessment.endsAt)
    return { ok: false, reason: "Waktu penilaian sudah berakhir." };
  return { ok: true };
}

/**
 * Memulai percobaan. Seluruh pemeriksaan — jendela waktu, batas percobaan,
 * dan percobaan yang masih berjalan — dilakukan dalam satu transaksi
 * serializable, sehingga dua tab yang ditekan bersamaan tidak dapat
 * menghasilkan dua percobaan sekaligus.
 */
export async function startAttempt(batchId: string, assessmentId: string) {
  const { enrollment, assessment } = await assessmentForParticipant(
    batchId,
    assessmentId,
  );
  if (enrollment.batch.status === "COMPLETED")
    throw new Error("Training sudah ditutup.");

  const window = attemptWindow(assessment);
  if (!window.ok) throw new Error(window.reason);

  return db.$transaction(
    async (tx) => {
      const existing = await tx.assessmentAttempt.findMany({
        where: { assessmentId, enrollmentId: enrollment.id },
        orderBy: { attemptNumber: "asc" },
      });

      const running = existing.find(
        (attempt) => !attempt.submittedAt && attempt.expiresAt > new Date(),
      );
      if (running) return running.id;

      // Percobaan yang ditinggalkan sampai habis waktunya ditutup dengan nilai
      // apa adanya, bukan dibiarkan menggantung.
      for (const attempt of existing)
        if (!attempt.submittedAt && attempt.expiresAt <= new Date())
          await finalize(tx, attempt.id);

      if (existing.length >= assessment.maxAttempts)
        throw new Error("Batas percobaan untuk penilaian ini sudah tercapai.");

      const snapshot = await pickQuestions(tx, assessmentId);
      const expiresAt = new Date(
        Date.now() + assessment.durationMinutes * 60 * 1000,
      );
      const attempt = await tx.assessmentAttempt.create({
        data: {
          assessmentId,
          enrollmentId: enrollment.id,
          attemptNumber: existing.length + 1,
          expiresAt:
            assessment.endsAt && assessment.endsAt < expiresAt
              ? assessment.endsAt
              : expiresAt,
          questionSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
      return attempt.id;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Menutup percobaan dan menghitung nilainya. Dipanggil saat peserta mengirim
 * dan saat waktunya habis; keduanya melewati jalur yang sama sehingga hasilnya
 * tidak dapat berbeda.
 */
async function finalize(tx: Prisma.TransactionClient, attemptId: string) {
  const attempt = await tx.assessmentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true, assessment: true },
  });
  if (attempt.submittedAt) return attempt;

  const snapshot = attempt.questionSnapshot as unknown as SnapshotQuestion[];
  const totalPoints = snapshot.reduce(
    (sum, question) => sum + question.points,
    0,
  );

  let earned = 0;
  let pending = false;
  for (const question of snapshot) {
    const answer = attempt.answers.find(
      (item) => item.questionId === question.id,
    );
    const score = answer ? gradeAnswer(question, answer.answer) : 0;
    if (score === null) {
      pending = true;
      continue;
    }
    earned += score;
    if (answer && answer.score === null)
      await tx.assessmentAnswer.update({
        where: { id: answer.id },
        data: { score },
      });
  }

  const score = totalPoints ? (earned / totalPoints) * 100 : 0;

  return tx.assessmentAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt: new Date(),
      // Nilai esai belum masuk, jadi kelulusan sengaja dikosongkan sampai
      // trainer selesai memeriksa. Angka sementara akan menyesatkan.
      score: pending ? null : score,
      passed: pending ? null : score >= attempt.assessment.passingGrade,
    },
  });
}

/**
 * Menyimpan jawaban lalu menutup percobaan. Batas waktu diperiksa terhadap
 * jam server: penghitung waktu di peramban hanya alat bantu baca, bukan
 * sumber kebenaran.
 */
export async function submitAttempt(
  batchId: string,
  attemptId: string,
  raw: Record<string, unknown>,
) {
  const user = await currentUser();
  const answers = submissionSchema.parse(raw);

  return db.$transaction(
    async (tx) => {
      const attempt = await tx.assessmentAttempt.findFirstOrThrow({
        where: {
          id: attemptId,
          enrollment: { participantId: user.id, batchId, deletedAt: null },
        },
      });
      if (attempt.submittedAt)
        throw new Error("Percobaan ini sudah dikirim sebelumnya.");

      const snapshot =
        attempt.questionSnapshot as unknown as SnapshotQuestion[];
      const ids = new Set(snapshot.map((question) => question.id));

      // Toleransi 30 detik menutupi waktu perjalanan jaringan, sehingga
      // pengiriman di detik terakhir tidak hangus karena latensi.
      const expired = Date.now() > attempt.expiresAt.getTime() + 30 * 1000;

      if (!expired)
        for (const [questionId, value] of Object.entries(answers)) {
          if (!ids.has(questionId)) continue;
          await tx.assessmentAnswer.upsert({
            where: {
              attemptId_questionId: { attemptId, questionId },
            },
            create: {
              attemptId,
              questionId,
              answer: value as Prisma.InputJsonValue,
            },
            update: { answer: value as Prisma.InputJsonValue },
          });
        }

      const finalized = await finalize(tx, attemptId);
      return { expired, score: finalized.score, passed: finalized.passed };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/** Percobaan esai yang menunggu penilaian trainer. */
export async function pendingReviews(trainerId: string, admin: boolean) {
  return db.assessmentAttempt.findMany({
    where: {
      submittedAt: { not: null },
      score: null,
      ...(admin
        ? {}
        : {
            assessment: {
              batch: { trainers: { some: { trainerId } } },
            },
          }),
    },
    include: {
      assessment: { include: { batch: true } },
      enrollment: { include: { participant: true } },
    },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });
}

/**
 * Menyimpan nilai esai. Setelah tidak ada lagi jawaban tanpa nilai, nilai
 * percobaan dihitung ulang dan kelulusannya ditetapkan.
 */
export async function gradeEssay(
  answerId: string,
  score: number,
  feedback: string,
) {
  const user = await currentUser();

  await db.$transaction(
    async (tx) => {
      const answer = await tx.assessmentAnswer.findUniqueOrThrow({
        where: { id: answerId },
        include: {
          attempt: {
            include: {
              answers: true,
              enrollment: true,
              assessment: {
                include: { batch: { include: { trainers: true } } },
              },
            },
          },
        },
      });

      const batch = answer.attempt.assessment.batch;
      const allowed =
        user.role === "ADMIN" ||
        user.role === "SUPER_ADMIN" ||
        batch.trainers.some((link) => link.trainerId === user.id);
      if (!allowed) throw new Error("Anda tidak menilai training ini.");

      const snapshot = answer.attempt
        .questionSnapshot as unknown as SnapshotQuestion[];
      const question = snapshot.find((item) => item.id === answer.questionId);
      if (!question)
        throw new Error("Soal tidak ditemukan pada percobaan ini.");
      if (score < 0 || score > question.points)
        throw new Error(`Nilai harus antara 0 dan ${question.points}.`);

      await tx.assessmentAnswer.update({
        where: { id: answerId },
        data: {
          score,
          feedback: feedback.slice(0, 2000),
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      const answers = await tx.assessmentAnswer.findMany({
        where: { attemptId: answer.attemptId },
      });
      const essayIds = snapshot
        .filter((item) => item.type === "ESSAY")
        .map((item) => item.id);
      const outstanding = essayIds.some((id) => {
        const item = answers.find((row) => row.questionId === id);
        return !item || item.score === null;
      });
      if (outstanding) return;

      const totalPoints = snapshot.reduce((sum, item) => sum + item.points, 0);
      const earned = answers.reduce((sum, item) => sum + (item.score ?? 0), 0);
      const value = totalPoints ? (earned / totalPoints) * 100 : 0;

      await tx.assessmentAttempt.update({
        where: { id: answer.attemptId },
        data: {
          score: value,
          passed: value >= answer.attempt.assessment.passingGrade,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "GRADE_ESSAY",
          entity: "assessmentAttempt",
          entityId: answer.attemptId,
          metadata: { score: value },
        },
      });

      // Dikabarkan hanya ketika esai terakhir selesai diperiksa, yaitu saat
      // nilai percobaannya benar-benar ada. Memberi tahu setiap kali satu esai
      // dinilai akan mengirim beberapa kabar untuk satu ujian yang sama.
      await notify(
        answer.attempt.enrollment.participantId,
        {
          title: "Hasil ujian tersedia",
          message: `${answer.attempt.assessment.title} sudah selesai diperiksa.`,
          href: `/my-training/${batch.id}/assessment/${answer.attempt.assessmentId}`,
          email: true,
        },
        tx,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
