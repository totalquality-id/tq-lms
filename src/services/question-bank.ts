import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { applyRules, parseRules, topicCounts } from "@/lib/question-selection";
import {
  assessmentSchema,
  parseOptions,
  questionSchema,
  selectionRulesSchema,
} from "@/schemas/assessment";
import { requireAdmin, requireBatchStaff } from "./access";
import { notifyParticipants } from "./notification";

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
      ? (data.optionItems ?? parseOptions(data.options))
      : [];

  return db.$transaction(async (tx) => {
    await tx.course.findFirstOrThrow({
      where: { id: data.courseId, deletedAt: null },
    });
    if (id) await tx.question.findFirstOrThrow({
      where: { id, courseId: data.courseId, deletedAt: null },
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
    selection: data.selection,
  };

  let announce = data.published;
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
    // Hanya peralihan draft menjadi terbit yang dikabarkan; menyunting
    // penilaian yang sudah terbit bukan kabar baru.
    announce = data.published && !existing.published;
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

  if (announce)
    await notifyParticipants(batchId, {
      title: "Penilaian dibuka",
      message: `${data.title} sudah dapat Anda kerjakan.`,
      href: `/my-training/${batchId}/assessment`,
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
 * Menetapkan daftar soal yang dipakai satu penilaian, pada urutan yang
 * diberikan, lalu memindahkan modenya ke MANUAL.
 *
 * Yang disimpan hanyalah rujukan ke soal. Teks dan kunci jawabannya baru
 * dibekukan ketika percobaan dimulai, sehingga menyunting soal masih
 * memperbaiki penilaian yang belum dikerjakan.
 */
export async function setAssessmentQuestions(
  batchId: string,
  assessmentId: string,
  questionIds: string[],
) {
  const { user } = await requireBatchStaff(batchId);
  if (questionIds.length === 0)
    throw new Error("Pilih setidaknya satu soal untuk penilaian ini.");

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
    if (rows.length === 0)
      throw new Error(
        "Soal yang dipilih tidak ada pada bank soal course training ini.",
      );
    await tx.assessmentQuestion.createMany({ data: rows });

    // Modenya ikut berpindah: daftar manual yang tersimpan tetapi tidak dipakai
    // adalah persis kebingungan yang ingin dihindari enum SelectionMode.
    await tx.assessment.update({
      where: { id: assessmentId },
      data: { selection: "MANUAL" },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "SET_ASSESSMENT_QUESTIONS",
        entity: "assessment",
        entityId: assessmentId,
      },
    });
  });
}

/**
 * Menyimpan aturan per topik, setelah memastikan bank soal sanggup memenuhinya.
 *
 * Kekurangan soal ditolak di sini, bukan dibiarkan muncul saat peserta menekan
 * "mulai": trainer yang sedang menyusun penilaian dapat langsung memperbaikinya,
 * sedangkan peserta di depan layar tidak bisa.
 */
export async function setSelectionRules(
  batchId: string,
  assessmentId: string,
  input: Record<string, unknown>,
) {
  const { user } = await requireBatchStaff(batchId);
  const rules = selectionRulesSchema.parse(input);

  const assessment = await db.assessment.findFirstOrThrow({
    where: { id: assessmentId, batchId, deletedAt: null },
    include: { batch: { select: { courseId: true } } },
  });

  const bank = await db.question.findMany({
    where: { courseId: assessment.batch.courseId, deletedAt: null },
    select: { id: true, topic: true },
  });

  const short = applyRules(rules, bank).outcomes.filter(
    (outcome) => outcome.taken < outcome.requested,
  );
  if (short.length)
    throw new Error(
      `Bank soal belum cukup: ${short
        .map(
          (outcome) =>
            `${outcome.topic} tersedia ${outcome.taken} dari ${outcome.requested}`,
        )
        .join("; ")}.`,
    );

  await db.assessment.update({
    where: { id: assessmentId },
    data: {
      selection: "RULES",
      selectionRules: rules.filter((rule) => rule.count > 0),
    },
  });

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "SET_SELECTION_RULES",
      entity: "assessment",
      entityId: assessmentId,
    },
  });
}

/** Topik pada bank soal course sebuah training, beserta jumlah soalnya. */
export async function courseTopics(batchId: string) {
  const batch = await db.trainingBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { courseId: true },
  });
  const bank = await db.question.findMany({
    where: { courseId: batch.courseId, deletedAt: null },
    select: { id: true, topic: true },
  });
  return topicCounts(bank);
}

/** Bank soal course sebuah training, untuk formulir pemilihan manual. */
export async function courseQuestions(batchId: string) {
  const batch = await db.trainingBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { courseId: true },
  });
  return db.question.findMany({
    where: { courseId: batch.courseId, deletedAt: null },
    select: {
      id: true,
      topic: true,
      text: true,
      type: true,
      difficulty: true,
      points: true,
    },
    orderBy: [{ topic: "asc" }, { text: "asc" }],
  });
}

export { parseRules };

export type QuestionFilters = {
  q?: string;
  courseId?: string;
  topic?: string;
  type?: string;
  difficulty?: string;
};

export function questionWhere(
  filters: QuestionFilters,
): Prisma.QuestionWhereInput {
  return {
    deletedAt: null,
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.topic ? { topic: filters.topic } : {}),
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
