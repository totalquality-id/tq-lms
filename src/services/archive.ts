import "server-only";

import { db } from "@/lib/db";
import { requireAdmin } from "./access";

export type ArchiveCategory =
  | "course"
  | "organization"
  | "batch"
  | "question"
  | "assessment"
  | "assignment";

export const ARCHIVE_CATEGORIES: {
  value: ArchiveCategory;
  label: string;
}[] = [
  { value: "course", label: "Course" },
  { value: "organization", label: "Organisasi" },
  { value: "batch", label: "Training" },
  { value: "question", label: "Soal" },
  { value: "assessment", label: "Penilaian" },
  { value: "assignment", label: "Tugas" },
];

export type ArchivedItem = {
  id: string;
  title: string;
  subtitle: string;
  category: ArchiveCategory;
  archivedAt: Date;
};

export async function listArchived(
  category: ArchiveCategory | undefined,
  q: string,
  page: number,
  size: number,
): Promise<{ items: ArchivedItem[]; total: number }> {
  await requireAdmin();

  const categories = category ? [category] : ARCHIVE_CATEGORIES.map((c) => c.value);
  const allItems: ArchivedItem[] = [];
  let totalCount = 0;

  for (const cat of categories) {
    const { items, count } = await fetchCategory(cat, q);
    allItems.push(...items);
    totalCount += count;
  }

  // Sort by archivedAt desc across categories
  allItems.sort((a, b) => b.archivedAt.getTime() - a.archivedAt.getTime());

  return {
    items: allItems.slice((page - 1) * size, page * size),
    total: totalCount,
  };
}

async function fetchCategory(
  category: ArchiveCategory,
  q: string,
): Promise<{ items: ArchivedItem[]; count: number }> {
  const search = q
    ? { contains: q, mode: "insensitive" as const }
    : undefined;

  if (category === "course") {
    const where = {
      deletedAt: { not: null },
      sourceCourseId: null,
      ...(search ? { title: search } : {}),
    };
    const [rows, count] = await Promise.all([
      db.course.findMany({
        where,
        select: { id: true, title: true, category: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
      db.course.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.category,
        category: "course" as const,
        archivedAt: r.deletedAt!,
      })),
      count,
    };
  }

  if (category === "organization") {
    const where = {
      deletedAt: { not: null },
      ...(search ? { name: search } : {}),
    };
    const [rows, count] = await Promise.all([
      db.organization.findMany({
        where,
        select: { id: true, name: true, industry: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
      db.organization.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.name,
        subtitle: r.industry || "Organisasi",
        category: "organization" as const,
        archivedAt: r.deletedAt!,
      })),
      count,
    };
  }

  if (category === "batch") {
    const where = {
      deletedAt: { not: null },
      ...(search
        ? {
            OR: [
              { title: search },
              { code: search },
            ],
          }
        : {}),
    };
    const [rows, count] = await Promise.all([
      db.trainingBatch.findMany({
        where,
        select: { id: true, title: true, code: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
      db.trainingBatch.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.code,
        category: "batch" as const,
        archivedAt: r.deletedAt!,
      })),
      count,
    };
  }

  if (category === "question") {
    const where = {
      deletedAt: { not: null },
      ...(search
        ? {
            OR: [
              { text: search },
              { topic: search },
            ],
          }
        : {}),
    };
    const [rows, count] = await Promise.all([
      db.question.findMany({
        where,
        select: { id: true, text: true, topic: true, deletedAt: true },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
      db.question.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.text.length > 80 ? r.text.slice(0, 80) + "…" : r.text,
        subtitle: r.topic,
        category: "question" as const,
        archivedAt: r.deletedAt!,
      })),
      count,
    };
  }

  if (category === "assessment") {
    const where = {
      deletedAt: { not: null },
      ...(search ? { title: search } : {}),
    };
    const [rows, count] = await Promise.all([
      db.assessment.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          deletedAt: true,
          batch: { select: { title: true } },
        },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
      db.assessment.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.batch.title,
        category: "assessment" as const,
        archivedAt: r.deletedAt!,
      })),
      count,
    };
  }

  if (category === "assignment") {
    const where = {
      deletedAt: { not: null },
      ...(search ? { title: search } : {}),
    };
    const [rows, count] = await Promise.all([
      db.assignment.findMany({
        where,
        select: {
          id: true,
          title: true,
          deletedAt: true,
          batch: { select: { title: true } },
        },
        orderBy: { deletedAt: "desc" },
        take: 200,
      }),
      db.assignment.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.batch.title,
        category: "assignment" as const,
        archivedAt: r.deletedAt!,
      })),
      count,
    };
  }

  return { items: [], count: 0 };
}

/** Restore a soft-deleted item by clearing its deletedAt field. */
export async function restoreArchived(
  category: ArchiveCategory,
  id: string,
) {
  const actor = await requireAdmin();

  if (category === "course") {
    await db.course.update({
      where: { id },
      data: { deletedAt: null, updatedBy: actor.id },
    });
  } else if (category === "organization") {
    await db.organization.update({
      where: { id },
      data: { deletedAt: null, updatedBy: actor.id },
    });
  } else if (category === "batch") {
    await db.trainingBatch.update({
      where: { id },
      data: { deletedAt: null, updatedBy: actor.id },
    });
  } else if (category === "question") {
    await db.question.update({
      where: { id },
      data: { deletedAt: null },
    });
  } else if (category === "assessment") {
    await db.assessment.update({
      where: { id },
      data: { deletedAt: null },
    });
  } else if (category === "assignment") {
    await db.assignment.update({
      where: { id },
      data: { deletedAt: null },
    });
  } else {
    throw new Error("Kategori arsip tidak dikenal.");
  }

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "RESTORE",
      entity: category,
      entityId: id,
    },
  });
}

/**
 * Permanently delete an archived item. Only items that are already archived
 * (deletedAt is set) can be permanently deleted to prevent accidental
 * destruction of active data.
 */
export async function deleteArchived(
  category: ArchiveCategory,
  id: string,
) {
  const actor = await requireAdmin();

  if (category === "course") {
    const course = await db.course.findFirstOrThrow({
      where: { id, deletedAt: { not: null }, sourceCourseId: null },
    });
    // Delete related data in order
    await db.questionOption.deleteMany({
      where: { question: { courseId: course.id } },
    });
    await db.assessmentQuestion.deleteMany({
      where: { question: { courseId: course.id } },
    });
    await db.question.deleteMany({ where: { courseId: course.id } });
    await db.lesson.deleteMany({
      where: { module: { courseId: course.id } },
    });
    await db.courseModule.deleteMany({ where: { courseId: course.id } });
    await db.course.delete({ where: { id } });
  } else if (category === "organization") {
    await db.organization.findFirstOrThrow({
      where: { id, deletedAt: { not: null } },
    });
    await db.organizationMember.deleteMany({
      where: { organizationId: id },
    });
    await db.organization.delete({ where: { id } });
  } else if (category === "batch") {
    await db.trainingBatch.findFirstOrThrow({
      where: { id, deletedAt: { not: null } },
    });
    // Refuse if there are enrollments with data
    const enrollCount = await db.enrollment.count({
      where: { batchId: id },
    });
    if (enrollCount > 0)
      throw new Error(
        "Training ini masih memiliki data peserta. Hapus peserta terlebih dahulu atau biarkan dalam arsip.",
      );
    await db.trainingBatch.delete({ where: { id } });
  } else if (category === "question") {
    await db.question.findFirstOrThrow({
      where: { id, deletedAt: { not: null } },
    });
    await db.questionOption.deleteMany({ where: { questionId: id } });
    await db.assessmentQuestion.deleteMany({ where: { questionId: id } });
    await db.question.delete({ where: { id } });
  } else if (category === "assessment") {
    await db.assessment.findFirstOrThrow({
      where: { id, deletedAt: { not: null } },
    });
    const attemptCount = await db.assessmentAttempt.count({
      where: { assessmentId: id },
    });
    if (attemptCount > 0)
      throw new Error(
        "Penilaian ini memiliki riwayat percobaan peserta dan tidak dapat dihapus permanen.",
      );
    await db.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
    await db.assessment.delete({ where: { id } });
  } else if (category === "assignment") {
    await db.assignment.findFirstOrThrow({
      where: { id, deletedAt: { not: null } },
    });
    const submissionCount = await db.assignmentSubmission.count({
      where: { assignmentId: id },
    });
    if (submissionCount > 0)
      throw new Error(
        "Tugas ini memiliki pengumpulan peserta dan tidak dapat dihapus permanen.",
      );
    await db.assignment.delete({ where: { id } });
  } else {
    throw new Error("Kategori arsip tidak dikenal.");
  }

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "DELETE",
      entity: category,
      entityId: id,
    },
  });
}
