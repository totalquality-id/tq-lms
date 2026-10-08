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
import {
  ensureBatchSynced,
  syncCopiesOfCourse,
  syncCopyQuestions,
} from "./course-sync";

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

  const questionId = await db.$transaction(async (tx) => {
    const course = await tx.course.findFirstOrThrow({
      where: { id: data.courseId, deletedAt: null },
      select: { sourceCourseId: true },
    });
    const existing = id
      ? await tx.question.findFirstOrThrow({
        where: { id, courseId: data.courseId, deletedAt: null },
        select: { sourceQuestionId: true },
      })
      : null;

    const values = {
      courseId: data.courseId,
      topic: data.topic,
      difficulty: data.difficulty,
      type: data.type,
      text: data.text,
      points: data.points,
      requiresReason: data.requiresReason,
      parentId: data.parentId || null,
      explanation: data.explanation || null,
      correctText: data.type === "SHORT_TEXT" ? data.correctText : null,
    };

    // Salinan training yang disunting di training terlepas dari induknya, agar
    // suntingan itu tidak ditimpa pada sinkron berikutnya.
    const question = id
      ? await tx.question.update({
        where: { id },
        data: {
          ...values,
          ...(course.sourceCourseId && existing?.sourceQuestionId
            ? { detached: true }
            : {}),
        },
      })
      : await tx.question.create({
        data: {
          ...values,
          position: await nextPosition(tx, data.courseId, values.parentId),
        },
      });

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

  // Dilakukan setelah transaksi: kegagalan sinkron tidak membatalkan soal yang
  // sudah tersimpan, dan ensureBatchSynced memperbaikinya saat training dibuka.
  // Tidak ada efek bila courseId ini adalah salinan, karena salinan tidak punya turunan.
  try {
    await syncCopiesOfCourse(data.courseId);
  } catch (error) {
    console.error("Sinkron soal ke training gagal:", error);
  }

  return questionId;
}

/** Posisi berikutnya di antara soal sesaudara: soal baru masuk di akhir. */
async function nextPosition(
  tx: Prisma.TransactionClient,
  courseId: string,
  parentId: string | null,
) {
  const max = await tx.question.aggregate({
    where: { courseId, parentId },
    _max: { position: true },
  });
  return (max._max.position ?? 0) + 1;
}

export async function archiveQuestion(id: string) {
  const actor = await requireAdmin();
  const current = await db.question.findUniqueOrThrow({
    where: { id },
    select: { sourceQuestionId: true },
  });
  // Mengarsipkan salinan di training adalah keputusan training itu sendiri,
  // jadi salinannya terlepas dan tidak dihidupkan lagi oleh induknya.
  const question = await db.question.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      ...(current.sourceQuestionId ? { detached: true } : {}),
    },
    select: { courseId: true },
  });
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "ARCHIVE",
      entity: "question",
      entityId: id,
    },
  });

  try {
    await syncCopiesOfCourse(question.courseId);
  } catch (error) {
    console.error("Sinkron arsip soal ke training gagal:", error);
  }
}

/**
 * Menaikkan atau menurunkan satu soal di antara soal sesaudaranya pada bank
 * soal induk. Urutan ini menjadi acuan di setiap training dan ujian, jadi
 * hanya dapat diatur di induk; salinan training mengikutinya lewat sinkron.
 */
export async function moveQuestion(id: string, direction: number) {
  const actor = await requireAdmin();
  if (direction !== -1 && direction !== 1) throw new Error("Arah tidak valid.");

  const courseId = await db.$transaction(
    async (tx) => {
      const question = await tx.question.findFirstOrThrow({
        where: { id, deletedAt: null },
        select: {
          courseId: true,
          parentId: true,
          course: { select: { sourceCourseId: true } },
        },
      });
      if (question.course.sourceCourseId)
        throw new Error(
          "Urutan soal training mengikuti bank soal induk. Atur urutannya di menu Bank soal.",
        );

      const siblings = await tx.question.findMany({
        where: {
          courseId: question.courseId,
          parentId: question.parentId,
          deletedAt: null,
        },
        select: { id: true, position: true },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });
      const index = siblings.findIndex((item) => item.id === id);
      const target = index + direction;
      if (target < 0 || target >= siblings.length) return null;
      [siblings[index], siblings[target]] = [siblings[target], siblings[index]];

      // Ditulis ulang 1..n: posisi lama bisa kembar, dan menukar dua angka
      // kembar tidak mengubah apa pun.
      for (const [order, item] of siblings.entries())
        if (item.position !== order + 1)
          await tx.question.update({
            where: { id: item.id },
            data: { position: order + 1 },
          });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "REORDER",
          entity: "question",
          entityId: id,
          metadata: { direction },
        },
      });
      return question.courseId;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (courseId)
    try {
      await syncCopiesOfCourse(courseId);
    } catch (error) {
      console.error("Sinkron urutan soal ke training gagal:", error);
    }
}

/**
 * Mengembalikan salinan training yang terlepas agar kembali mengikuti induknya.
 * Isi, pilihan jawaban, dan status arsipnya langsung disamakan dengan induk.
 */
export async function reattachQuestion(id: string) {
  const actor = await requireAdmin();
  const question = await db.question.findFirstOrThrow({
    where: { id, sourceQuestionId: { not: null } },
    select: { courseId: true },
  });
  await db.$transaction(
    async (tx) => {
      await tx.question.update({ where: { id }, data: { detached: false } });
      await syncCopyQuestions(tx, question.courseId);
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "REATTACH",
          entity: "question",
          entityId: id,
        },
      });
    },
    { timeout: 30000 },
  );
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
    await db.$transaction(async (tx) => {
      await tx.assessment.update({ where: { id }, data: values });
      // Status lulus percobaan disimpan, jadi ikut disamakan ketika nilai
      // kelulusan berubah. Tanpa ini peserta melihat "lulus" pada percobaannya
      // sementara syarat sertifikat, yang membaca nilai kelulusan terbaru,
      // menyatakan sebaliknya.
      if (existing.passingGrade !== data.passingGrade) {
        await tx.assessmentAttempt.updateMany({
          where: { assessmentId: id, score: { gte: data.passingGrade } },
          data: { passed: true },
        });
        await tx.assessmentAttempt.updateMany({
          where: { assessmentId: id, score: { lt: data.passingGrade } },
          data: { passed: false },
        });
      }
    });
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

/** Urutan bank soal: acuan tunggal untuk bank, pemilihan manual, dan ujian. */
export const BANK_ORDER = [
  { position: "asc" },
  { id: "asc" },
] satisfies Prisma.QuestionOrderByWithRelationInput[];

/**
 * Menetapkan daftar soal yang dipakai satu penilaian, lalu memindahkan modenya
 * ke MANUAL. Urutannya mengikuti bank soal, bukan urutan pengiriman formulir,
 * sehingga ujian tidak pernah tersusun berbeda dari bank soal acuannya.
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
  await ensureBatchSynced(batchId);
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
      orderBy: BANK_ORDER,
    });

    await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });
    const rows = valid.map((question, index) => ({
      assessmentId,
      questionId: question.id,
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
  await ensureBatchSynced(batchId);

  const assessment = await db.assessment.findFirstOrThrow({
    where: { id: assessmentId, batchId, deletedAt: null },
    include: { batch: { select: { courseId: true } } },
  });

  // Aturan menghitung soal utama: studi kasus dihitung satu beserta
  // sub-soalnya, sama seperti saat soal diundi untuk peserta.
  const bank = await db.question.findMany({
    where: { courseId: assessment.batch.courseId, deletedAt: null, parentId: null },
    select: { id: true, topic: true },
  });

  const short = applyRules(rules, bank, false).outcomes.filter(
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
  await ensureBatchSynced(batchId);
  const batch = await db.trainingBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { courseId: true },
  });
  const bank = await db.question.findMany({
    where: { courseId: batch.courseId, deletedAt: null, parentId: null },
    select: { id: true, topic: true },
  });
  return topicCounts(bank);
}

/** Bank soal course sebuah training, untuk formulir pemilihan manual. */
export async function courseQuestions(batchId: string) {
  await ensureBatchSynced(batchId);
  const batch = await db.trainingBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { courseId: true },
  });
  return db.question.findMany({
    where: { courseId: batch.courseId, deletedAt: null, parentId: null },
    select: {
      id: true,
      topic: true,
      text: true,
      type: true,
      difficulty: true,
      points: true,
    },
    orderBy: BANK_ORDER,
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
