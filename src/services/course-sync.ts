import "server-only";

import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type Client = Prisma.TransactionClient;

const withOptions = {
    options: { orderBy: { position: "asc" } },
} satisfies Prisma.QuestionInclude;
type BankQuestion = Prisma.QuestionGetPayload<{ include: typeof withOptions }>;

/** Isi soal yang mengikuti induk. Urutan, induk studi kasus, dan arsip ditangani terpisah. */
const CONTENT = [
    "topic",
    "difficulty",
    "type",
    "text",
    "correctText",
    "explanation",
    "points",
    "requiresReason",
] as const;

type OptionRow = { text: string; correct: boolean; position: number };

type Plan = {
    copyId: string;
    create: Prisma.QuestionCreateManyInput[];
    createOptions: Prisma.QuestionOptionCreateManyInput[];
    update: {
        id: string;
        data: Prisma.QuestionUncheckedUpdateInput;
        options: OptionRow[] | null;
    }[];
};

const optionRows = (question: BankQuestion): OptionRow[] =>
    question.options.map(({ text, correct, position }) => ({ text, correct, position }));

const sameOptions = (a: OptionRow[], b: OptionRow[]) =>
    a.length === b.length &&
    a.every(
        (option, index) =>
            option.text === b[index].text &&
            option.correct === b[index].correct &&
            option.position === b[index].position,
    );

/**
 * Membandingkan bank soal salinan training dengan induknya dan menyusun daftar
 * perubahan yang dibutuhkan. Tidak menulis apa pun, sehingga dapat dipakai
 * untuk memeriksa dengan murah apakah sinkron perlu dijalankan.
 *
 * Aturannya:
 * - Soal induk yang belum ada di salinan ditambahkan (kecuali yang diarsipkan).
 * - Salinan yang tidak terlepas mengikuti isi, pilihan jawaban, induk studi
 *   kasus, dan status arsip induknya — termasuk ketika induk dipulihkan.
 * - Salinan terlepas (disunting/diarsipkan di training) tidak disentuh isinya.
 * - Urutan selalu mengikuti induk, terlepas atau tidak.
 * - Soal yang dibuat khusus di training tidak punya induk dan tidak disentuh.
 */
async function planSync(client: Client, copyId: string): Promise<Plan | null> {
    const copy = await client.course.findUnique({
        where: { id: copyId },
        select: { id: true, sourceCourseId: true },
    });
    if (!copy?.sourceCourseId) return null;

    const [source, copies] = await Promise.all([
        client.question.findMany({
            where: { courseId: copy.sourceCourseId },
            include: withOptions,
            orderBy: [{ position: "asc" }, { id: "asc" }],
        }),
        client.question.findMany({
            where: { courseId: copy.id },
            include: withOptions,
        }),
    ]);

    const byId = new Map(copies.map((question) => [question.id, question]));
    const bySource = new Map(
        copies
            .filter((question) => question.sourceQuestionId)
            .map((question) => [question.sourceQuestionId!, question]),
    );
    // Salinan hasil migrasi memakai format id lama: tq_<batchId>_<idSumber>.
    const legacyPrefix = copy.id.startsWith("tc_") ? `tq_${copy.id.slice(3)}_` : null;
    const linked = (sourceId: string) =>
        bySource.get(sourceId) ??
        byId.get(`${copy.id}_${sourceId}`) ??
        (legacyPrefix ? byId.get(legacyPrefix + sourceId) : undefined);

    const plan: Plan = { copyId: copy.id, create: [], createOptions: [], update: [] };

    // Soal induk lebih dulu, sehingga sub-soal tahu salinan induknya.
    const ordered = [
        ...source.filter((question) => !question.parentId),
        ...source.filter((question) => question.parentId),
    ];
    const available = new Map<string, string>();
    for (const question of ordered) {
        const parent = question.parentId ? available.get(question.parentId) : null;
        // Sub-soal dari studi kasus yang tidak ada di salinan ikut tersembunyi,
        // sama seperti di bank soal induk.
        if (question.parentId && !parent) continue;

        const existing = linked(question.id);
        if (!existing) {
            if (question.deletedAt) continue;
            const id = `${copy.id}_${question.id}`;
            available.set(question.id, id);
            plan.create.push({
                id,
                courseId: copy.id,
                sourceQuestionId: question.id,
                parentId: parent,
                position: question.position,
                ...Object.fromEntries(CONTENT.map((field) => [field, question[field]])),
            } as Prisma.QuestionCreateManyInput);
            plan.createOptions.push(
                ...optionRows(question).map((option) => ({ ...option, questionId: id })),
            );
            continue;
        }

        available.set(question.id, existing.id);
        const data: Prisma.QuestionUncheckedUpdateInput = {};
        if (existing.sourceQuestionId !== question.id) data.sourceQuestionId = question.id;
        if (existing.position !== question.position) data.position = question.position;

        let options: OptionRow[] | null = null;
        if (!existing.detached) {
            for (const field of CONTENT)
                if (existing[field] !== question[field])
                    (data as Record<string, unknown>)[field] = question[field];
            if (existing.parentId !== parent) data.parentId = parent;
            if (question.deletedAt && !existing.deletedAt) data.deletedAt = new Date();
            if (!question.deletedAt && existing.deletedAt) data.deletedAt = null;
            const wanted = optionRows(question);
            if (!sameOptions(optionRows(existing), wanted)) options = wanted;
        }

        if (Object.keys(data).length || options)
            plan.update.push({ id: existing.id, data, options });
    }

    return plan;
}

const isEmpty = (plan: Plan | null) =>
    !plan || (!plan.create.length && !plan.update.length);

/**
 * Menyamakan bank soal salinan training dengan induknya. Harus dipanggil di
 * dalam transaksi: kunci advisory membuat dua sinkron pada salinan yang sama
 * berjalan bergantian, dan pilihan jawaban yang ditulis ulang tidak pernah
 * terlihat kosong oleh pembaca lain.
 */
export async function syncCopyQuestions(tx: Client, copyId: string): Promise<number> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${copyId}))::text AS locked`;
    const plan = await planSync(tx, copyId);
    if (!plan || isEmpty(plan)) return 0;

    // Induk studi kasus harus ada lebih dulu daripada anaknya.
    const parents = plan.create.filter((row) => !row.parentId);
    const children = plan.create.filter((row) => row.parentId);
    if (parents.length) await tx.question.createMany({ data: parents });
    if (children.length) await tx.question.createMany({ data: children });
    if (plan.createOptions.length)
        await tx.questionOption.createMany({ data: plan.createOptions });

    for (const { id, data } of plan.update)
        if (Object.keys(data).length) await tx.question.update({ where: { id }, data });

    const replaced = plan.update.filter((item) => item.options);
    if (replaced.length) {
        await tx.questionOption.deleteMany({
            where: { questionId: { in: replaced.map((item) => item.id) } },
        });
        await tx.questionOption.createMany({
            data: replaced.flatMap((item) =>
                item.options!.map((option) => ({ ...option, questionId: item.id })),
            ),
        });
    }

    return plan.create.length + plan.update.length;
}

/**
 * Sinkron satu salinan di luar transaksi pemanggil. Pemeriksaan pertama tanpa
 * transaksi: pada keadaan tunak tidak ada yang berbeda, sehingga membuka
 * halaman tidak menulis apa pun.
 */
async function syncCopy(copyId: string) {
    if (isEmpty(await planSync(db, copyId))) return 0;
    return db.$transaction((tx) => syncCopyQuestions(tx, copyId), { timeout: 30000 });
}

/** Dorong perubahan bank soal course induk ke semua training yang masih berjalan. */
export async function syncCopiesOfCourse(sourceCourseId: string) {
    const copies = await db.course.findMany({
        where: {
            sourceCourseId,
            deletedAt: null,
            batches: { some: { deletedAt: null, status: { not: "COMPLETED" } } },
        },
        select: { id: true },
    });
    for (const copy of copies) await syncCopy(copy.id);
}

/**
 * Jaring pengaman saat membaca: menyinkronkan satu training sebelum bank
 * soalnya dipakai, untuk perubahan yang tidak sempat didorong (misalnya
 * sinkron yang gagal, atau soal yang diimpor lewat skrip).
 * `cache` mencegah dua pembacaan paralel pada satu request menjalankannya dua kali.
 */
export const ensureBatchSynced = cache(async (batchId: string) => {
    const batch = await db.trainingBatch.findUnique({
        where: { id: batchId },
        select: { courseId: true, status: true, deletedAt: true },
    });
    if (!batch || batch.deletedAt || batch.status === "COMPLETED") return;
    await syncCopy(batch.courseId);
});
