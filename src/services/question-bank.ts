import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  assessmentSchema,
  parseOptions,
  questionSchema,
} from "@/schemas/assessment";
import { requireAdmin, requireBatchStaff } from "./access";

/**
 * Menyimpan satu butir soal beserta pilihannya. Pilihan ditulis ulang setiap
 * kali disimpan; percobaan yang sedang berjalan tidak terpengaruh karena
 * percobaan menyimpan salinan soalnya sendiri.
 */
export async function saveQuestion(
  id: string | undefined,
  input: Record<string, unknown>,
) {
  const actor = await requireAdmin();
  const data = questionSchema.parse(input);
  const choices =
    data.type === "SINGLE_CHOICE" ||
    data.type === "MULTIPLE_CHOICE" ||
    data.type === "TRUE_FALSE"
      ? parseOptions(data.options)
      : [];

  return db.$transaction(async (tx) => {
    await tx.course.findFirstOrThrow({
      where: { id: data.courseId, deletedAt: null },
    });

    const values = {
      courseId: data.courseId,
      topic: data.topic,
      difficulty: data.difficulty,
      type: data.type,
      text: data.text,
      points: data.points,
      explanation: data.explanation || null,
      correctText: data.type === "SHORT_TEXT" ? data.correctText : null,
    };

    const question = id
      ? await tx.question.update({ where: { id }, data: values })
      : await tx.question.create({ data: values });

    if (id) await tx.questionOption.deleteMany({ where: { questionId: id } });
    if (choices.length)
      await tx.questionOption.createMany({
        data: choices.map((choice, index) => ({
          questionId: question.id,
          text: choice.text,
          correct: choice.correct,
          position: index + 1,
        })),
      });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: id ? "UPDATE" : "CREATE",
        entity: "question",
        entityId: question.id,
      },
    });

    return question.id;
  });
}

export async function archiveQuestion(id: string) {
  const actor = await requireAdmin();
  await db.question.update({ where: { id }, data: { deletedAt: new Date() } });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "ARCHIVE",
      entity: "question",
      entityId: id,
    },
  });
}

/**
 * Menyusun konfigurasi penilaian pada satu training. Penerbitan dipisahkan
 * dari penyusunan: penilaian yang belum dipublikasikan tidak terlihat oleh
 * peserta, sehingga trainer dapat menyiapkannya sambil kelas berjalan.
 */
export async function saveAssessment(
  batchId: string,
  id: string | undefined,
  input: Record<string, unknown>,
) {
  const { user } = await requireBatchStaff(batchId);
  const data = assessmentSchema.parse(input);

  const values = {
    title: data.title,
    type: data.type,
    instructions: data.instructions,
    durationMinutes: data.durationMinutes,
    passingGrade: data.passingGrade,
    maxAttempts: data.maxAttempts,
    questionLimit: data.questionLimit || null,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    randomizeQuestions: data.randomizeQuestions,
    randomizeOptions: data.randomizeOptions,
    showResult: data.showResult,
    showAnswers: data.showAnswers,
    published: data.published,
  };

  if (id) {
    const existing = await db.assessment.findFirstOrThrow({
      where: { id, batchId, deletedAt: null },
      include: { _count: { select: { attempts: true } } },
    });
    // Mengubah jenis penilaian setelah ada percobaan akan memindahkan nilai
    // yang sudah tercatat ke kategori yang salah pada rekap dan sertifikat.
    if (existing._count.attempts && existing.type !== data.type)
      throw new Error(
        "Jenis penilaian tidak dapat diubah setelah ada percobaan peserta.",
      );
    await db.assessment.update({ where: { id }, data: values });
  } else {
    await db.assessment.create({ data: { ...values, batchId } });
  }

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "assessment",
      entityId: id ?? batchId,
    },
  });
}

export async function archiveAssessment(batchId: string, id: string) {
  const { user } = await requireBatchStaff(batchId);
  await db.assessment.updateMany({
    where: { id, batchId },
    data: { deletedAt: new Date(), published: false },
  });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "ARCHIVE",
      entity: "assessment",
      entityId: id,
    },
  });
}

/**
 * Menetapkan daftar soal yang dipakai satu penilaian. Daftar kosong berarti
 * soal diambil acak dari bank soal course — aturan ini dibaca kembali saat
 * percobaan dimulai, bukan disimpan sebagai salinan di sini.
 */
export async function setAssessmentQuestions(
  batchId: string,
  assessmentId: string,
  questionIds: string[],
) {
  await requireBatchStaff(batchId);

  await db.$transaction(async (tx) => {
    const assessment = await tx.assessment.findFirstOrThrow({
      where: { id: assessmentId, batchId, deletedAt: null },
      include: { batch: { select: { courseId: true } } },
    });

    const valid = await tx.question.findMany({
      where: {
        id: { in: questionIds.slice(0, 200) },
        courseId: assessment.batch.courseId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const allowed = new Set(valid.map((question) => question.id));

    await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });
    const rows = questionIds
      .filter((id) => allowed.has(id))
      .map((questionId, index) => ({
        assessmentId,
        questionId,
        position: index + 1,
      }));
    if (rows.length)
      await tx.assessmentQuestion.createMany({ data: rows });
  });
}

export type QuestionFilters = {
  q?: string;
  courseId?: string;
  type?: string;
  difficulty?: string;
};

export function questionWhere(filters: QuestionFilters): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.type
      ? { type: filters.type as Prisma.QuestionWhereInput["type"] }
      : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(filters.q
      ? {
          OR: [
            { text: { contains: filters.q, mode: "insensitive" as const } },
            { topic: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}
