import "server-only";

import { notFound } from "next/navigation";
import { Prisma, type QuestionType } from "@prisma/client";

import { db } from "@/lib/db";
import {
  attemptScore,
  gradeAnswer,
  isAnswerable,
  visibleQuestions,
  type SnapshotQuestion,
} from "@/lib/grading";
import {
  parseRules,
  selectQuestions,
  shuffleInPlace as shuffle,
} from "@/lib/question-selection";
import { currentUser, requireBatchStaff } from "./access";
import { notify } from "./notification";

// Penilaian objektif adalah logika murni dan tinggal di lib, agar aturannya
// dapat diuji tanpa basis data.
export { bestScore, gradeAnswer, visibleQuestions } from "@/lib/grading";
export type { SnapshotQuestion, VisibleQuestion } from "@/lib/grading";
import { myEnrollment } from "./learning";
import { submissionSchema } from "@/schemas/assessment";
import { ensureBatchSynced } from "./course-sync";
import { BANK_ORDER } from "./question-bank";

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
      questions: { select: { questionId: true } },
    },
  });

  // Bank soal selalu dibaca seluruhnya agar bisa mengaitkan anak dengan induknya.
  // Urutannya adalah urutan bank soal, acuan untuk setiap mode pemilihan.
  const allBank = await tx.question.findMany({
    where: { courseId: assessment.batch.courseId, deletedAt: null },
    include: { options: { orderBy: { position: "asc" } } },
    orderBy: BANK_ORDER,
  });

  const childrenByParent = new Map<string, typeof allBank>();
  for (const q of allBank) {
    if (q.parentId) {
      if (!childrenByParent.has(q.parentId)) {
        childrenByParent.set(q.parentId, []);
      }
      childrenByParent.get(q.parentId)!.push(q);
    }
  }

  // Studi kasus yang tidak lagi punya sub-soal aktif hanya berisi teks tanpa
  // pertanyaan, jadi tidak ikut diundi.
  const topLevelBank = allBank.filter(
    (q) =>
      !q.parentId &&
      (q.type !== "CASE_STUDY" || childrenByParent.has(q.id)),
  );
  // Daftar manual disusun ulang menurut bank soal, sehingga daftar lama yang
  // tersimpan dalam urutan lain pun ikut urutan acuan.
  const chosen = new Set(assessment.questions.map((link) => link.questionId));
  const topLevelManual = topLevelBank.filter((q) => chosen.has(q.id));

  const { questions: selectedTopLevel } = selectQuestions(
    {
      mode: assessment.selection,
      rules: parseRules(assessment.selectionRules),
      limit: assessment.questionLimit,
      randomize: assessment.randomizeQuestions,
    },
    { manual: topLevelManual, bank: topLevelBank },
  );

  const questions = selectedTopLevel.flatMap((parent) => {
    const children = childrenByParent.get(parent.id) || [];
    // Jangan mengacak urutan anak, karena biasanya studi kasus berurutan logis
    return [parent, ...children];
  });

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
    requiresReason: question.requiresReason,
    parentId: question.parentId,
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

export async function previewAssessment(batchId: string, assessmentId: string) {
  await requireBatchStaff(batchId);
  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, batchId, deletedAt: null },
    select: { id: true },
  });
  if (!assessment) notFound();
  await ensureBatchSynced(batchId);
  // Memakai pemilih soal peserta, tanpa membuat percobaan atau menyimpan jawaban.
  return visibleQuestions(await pickQuestions(db, assessment.id));
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

  await ensureBatchSynced(batchId);

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
  const byId = new Map(snapshot.map((question) => [question.id, question]));

  const scores = new Map<string, number | null>();
  for (const answer of attempt.answers) {
    const question = byId.get(answer.questionId);
    if (!question || !isAnswerable(question)) continue;
    const score = answer.score ?? gradeAnswer(question, answer.answer);
    scores.set(question.id, score);
    if (score !== null && answer.score === null)
      await tx.assessmentAnswer.update({
        where: { id: answer.id },
        data: { score },
      });
  }

  // Nilai esai belum masuk, jadi kelulusan sengaja dikosongkan sampai
  // trainer selesai memeriksa. Angka sementara akan menyesatkan.
  const { pending, score } = attemptScore(snapshot, scores);
  return tx.assessmentAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt: new Date(),
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
 * Menyimpan nilai satu jawaban dari trainer: menilai esai, atau mengoreksi
 * nilai otomatis (misalnya isian singkat yang benar tetapi ditulis berbeda,
 * atau alasan Benar/Salah yang tidak mendukung jawabannya). Nilai percobaan
 * dihitung ulang setiap kali; selama masih ada esai yang belum dinilai,
 * nilainya tetap kosong.
 */
export async function reviewAnswer(
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
              enrollment: true,
              assessment: {
                include: { batch: { include: { trainers: true } } },
              },
            },
          },
        },
      });

      const { attempt } = answer;
      const batch = attempt.assessment.batch;
      const allowed =
        user.role === "ADMIN" ||
        user.role === "SUPER_ADMIN" ||
        batch.trainers.some((link) => link.trainerId === user.id);
      if (!allowed) throw new Error("Anda tidak menilai training ini.");
      if (!attempt.submittedAt)
        throw new Error("Percobaan ini belum dikirim peserta.");

      const snapshot = attempt.questionSnapshot as unknown as SnapshotQuestion[];
      const question = snapshot.find((item) => item.id === answer.questionId);
      if (!question || !isAnswerable(question))
        throw new Error("Soal tidak ditemukan pada percobaan ini.");
      if (!Number.isFinite(score) || score < 0 || score > question.points)
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
        where: { attemptId: attempt.id },
        select: { questionId: true, score: true },
      });
      const { pending, score: value } = attemptScore(
        snapshot,
        new Map(answers.map((row) => [row.questionId, row.score])),
      );

      await tx.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          score: pending ? null : value,
          passed: pending ? null : value >= attempt.assessment.passingGrade,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "REVIEW_ANSWER",
          entity: "assessmentAttempt",
          entityId: attempt.id,
          metadata: {
            answerId,
            questionId: answer.questionId,
            from: answer.score,
            to: score,
            attemptScore: pending ? null : value,
          },
        },
      });

      // Dikabarkan hanya ketika nilai percobaan baru saja tersedia. Koreksi
      // atas nilai yang sudah ada, atau setiap esai yang dinilai satu per
      // satu, tidak mengirim kabar berulang untuk ujian yang sama.
      if (attempt.score === null && !pending)
        await notify(
          attempt.enrollment.participantId,
          {
            title: "Hasil ujian tersedia",
            message: `${attempt.assessment.title} sudah selesai diperiksa.`,
            href: `/my-training/${batch.id}/assessment/${attempt.assessmentId}`,
            email: true,
          },
          tx,
        );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Satu percobaan yang sudah dikirim, untuk diperiksa staf training: soal
 * sebagaimana dibekukan, jawaban peserta, dan nilai per soal.
 */
export async function attemptForStaff(batchId: string, attemptId: string) {
  await requireBatchStaff(batchId);
  const attempt = await db.assessmentAttempt.findFirst({
    where: {
      id: attemptId,
      submittedAt: { not: null },
      assessment: { batchId },
    },
    include: {
      answers: true,
      assessment: { select: { id: true, title: true, passingGrade: true } },
      enrollment: {
        select: { participant: { select: { name: true, email: true } } },
      },
    },
  });
  if (!attempt) notFound();

  const others = await db.assessmentAttempt.findMany({
    where: {
      assessmentId: attempt.assessmentId,
      enrollmentId: attempt.enrollmentId,
      submittedAt: { not: null },
    },
    select: { id: true, attemptNumber: true, score: true },
    orderBy: { attemptNumber: "asc" },
  });

  return {
    attempt,
    snapshot: attempt.questionSnapshot as unknown as SnapshotQuestion[],
    others,
  };
}
