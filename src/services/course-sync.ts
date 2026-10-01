import "server-only";

import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type Client = Prisma.TransactionClient;

/**
 * Menambahkan soal course induk yang belum ada pada salinan training.
 * Hanya menambah: soal yang sudah ada (termasuk yang diarsipkan di salinan)
 * tidak disentuh, sehingga suntingan khusus training tetap utuh.
 * Idempoten: aman dipanggil berulang dan bersamaan.
 */
export async function syncCopyQuestions(
    tx: Client,
    copyId: string,
): Promise<number> {
    const copy = await tx.course.findUnique({
        where: { id: copyId },
        select: { id: true, sourceCourseId: true },
    });
    if (!copy?.sourceCourseId) return 0;

    const source = await tx.question.findMany({
        where: { courseId: copy.sourceCourseId, deletedAt: null },
        include: { options: true },
        orderBy: { id: "asc" },
    });
    // Termasuk yang sudah diarsipkan: soal yang dibuang di salinan tidak dihidupkan lagi.
    const existing = await tx.question.findMany({
        where: { courseId: copy.id },
        select: { id: true },
    });
    const have = new Set(existing.map((question) => question.id));

    // Salinan hasil migrasi memakai format id lama: tq_<batchId>_<idSumber>.
    const legacyPrefix = copy.id.startsWith("tc_")
        ? `tq_${copy.id.slice(3)}_`
        : null;
    const copyIdOf = (sourceId: string) => {
        if (legacyPrefix && have.has(legacyPrefix + sourceId))
            return legacyPrefix + sourceId;
        return `${copy.id}_${sourceId}`;
    };

    // Sinkronisasi pengarsipan: soal yang diarsipkan di induk juga diarsipkan di salinan.
    const sourceArchived = await tx.question.findMany({
        where: { courseId: copy.sourceCourseId, deletedAt: { not: null } },
        select: { id: true },
    });
    
    const archivedIdsToSync = sourceArchived
        .map((question) => copyIdOf(question.id))
        .filter((id) => have.has(id));

    if (archivedIdsToSync.length > 0) {
        await tx.question.updateMany({
            where: { id: { in: archivedIdsToSync }, deletedAt: null },
            data: { deletedAt: new Date() },
        });
    }

    const missing = source.filter((question) => !have.has(copyIdOf(question.id)));
    if (missing.length === 0) return archivedIdsToSync.length;

    const missingIds = new Set(missing.map((question) => copyIdOf(question.id)));
    const rows = missing.map((question) => {
        const parent = question.parentId ? copyIdOf(question.parentId) : null;
        return {
            id: copyIdOf(question.id),
            courseId: copy.id,
            topic: question.topic,
            difficulty: question.difficulty,
            type: question.type,
            text: question.text,
            correctText: question.correctText,
            explanation: question.explanation,
            points: question.points,
            requiresReason: question.requiresReason,
            parentId:
                parent && (have.has(parent) || missingIds.has(parent)) ? parent : null,
        };
    });

    // Induk (studi kasus) harus ada lebih dulu daripada anaknya.
    await tx.question.createMany({
        data: rows.filter((row) => !row.parentId),
        skipDuplicates: true,
    });
    await tx.question.createMany({
        data: rows.filter((row) => row.parentId),
        skipDuplicates: true,
    });
    await tx.questionOption.createMany({
        data: missing.flatMap((question) =>
            question.options.map((option) => ({
                questionId: copyIdOf(question.id),
                text: option.text,
                correct: option.correct,
                position: option.position,
            })),
        ),
        skipDuplicates: true,
    });

    return missing.length + archivedIdsToSync.length;
}

/** Dorong soal baru course induk ke semua training yang masih berjalan. */
export async function syncCopiesOfCourse(sourceCourseId: string) {
    const copies = await db.course.findMany({
        where: {
            sourceCourseId,
            deletedAt: null,
            batches: { some: { deletedAt: null, status: { not: "COMPLETED" } } },
        },
        select: { id: true },
    });
    for (const copy of copies) await syncCopyQuestions(db, copy.id);
}

/**
 * Jaring pengaman saat membaca: menyinkronkan satu training sebelum bank
 * soalnya dipakai. Sekaligus memperbaiki training lama yang sudah tertinggal.
 * `cache` mencegah dua pembacaan paralel pada satu request menjalankannya dua kali.
 */
export const ensureBatchSynced = cache(async (batchId: string) => {
    const batch = await db.trainingBatch.findUnique({
        where: { id: batchId },
        select: { courseId: true, status: true, deletedAt: true },
    });
    if (!batch || batch.deletedAt || batch.status === "COMPLETED") return;
    await syncCopyQuestions(db, batch.courseId);
});