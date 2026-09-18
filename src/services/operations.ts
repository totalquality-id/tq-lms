import "server-only";

import { AttendanceStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  EVALUATION_TEMPLATE,
  type EvaluationQuestion,
} from "@/lib/evaluation-template";
import { removeObject } from "@/lib/supabase-storage";
import { RESOURCE_MAX_BYTES, fileNameOf, mimeOf } from "@/lib/upload";
import { calendarDate, dateInput, dateTime } from "@/lib/utils";
import { currentUser, requireBatchStaff } from "./access";
import { confirmUpload } from "./file";
import { myEnrollment } from "./learning";
import { notifyBatchStaff, notifyParticipants, notify } from "./notification";

export { EVALUATION_TEMPLATE };
export type { EvaluationQuestion };

/* -------------------------------------------------------------------------
   Presensi
   ------------------------------------------------------------------------- */

const attendanceSchema = z.object({
  enrollmentId: z.string().min(1),
  date: z.iso.date(),
  status: z.enum(AttendanceStatus),
});

/**
 * Menandai kehadiran satu peserta pada satu hari pelatihan. Tanggal disimpan
 * sebagai tanggal kalender Jakarta, bukan momen waktu, supaya "Hari 1" tetap
 * hari yang sama bagi trainer di zona mana pun.
 */
export async function markAttendance(
  batchId: string,
  input: Record<string, unknown>,
) {
  const { user, batch } = await requireBatchStaff(batchId);
  const data = attendanceSchema.parse(input);

  const day = calendarDate(data.date);
  const start = calendarDate(dateInput(batch.startDate));
  const end = calendarDate(dateInput(batch.endDate));
  if (day < start || day > end)
    throw new Error("Tanggal berada di luar jadwal training.");

  const enrollment = await db.enrollment.findFirstOrThrow({
    where: { id: data.enrollmentId, batchId, deletedAt: null },
  });

  await db.attendance.upsert({
    where: {
      enrollmentId_date: { enrollmentId: enrollment.id, date: day },
    },
    create: {
      enrollmentId: enrollment.id,
      date: day,
      status: data.status,
      markedBy: user.id,
    },
    update: { status: data.status, markedBy: user.id },
  });
}

/* -------------------------------------------------------------------------
   Tugas
   ------------------------------------------------------------------------- */

export const assignmentSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    instructions: z
      .string()
      .trim()
      .min(5, "Tuliskan instruksi tugas.")
      .max(5000),
    dueAt: z.string().min(1, "Isi batas waktu pengumpulan."),
    maxScore: z.coerce.number().int().min(1).max(1000),
    required: z.enum(["true", "false"]).transform((value) => value === "true"),
    published: z.enum(["true", "false"]).transform((value) => value === "true"),
  })
  .refine((value) => !Number.isNaN(Date.parse(value.dueAt)), {
    path: ["dueAt"],
    message: "Batas waktu tidak valid.",
  });

export async function saveAssignment(
  batchId: string,
  id: string | undefined,
  input: Record<string, unknown>,
) {
  const { user } = await requireBatchStaff(batchId);
  const data = assignmentSchema.parse(input);
  const values = {
    title: data.title,
    instructions: data.instructions,
    dueAt: new Date(data.dueAt),
    maxScore: data.maxScore,
    required: data.required,
    published: data.published,
  };

  let announce = data.published;
  if (id) {
    const existing = await db.assignment.findFirstOrThrow({
      where: { id, batchId, deletedAt: null },
    });
    // Hanya peralihan draft menjadi terbit yang diumumkan. Menyunting judul
    // tugas yang sudah terbit bukan kabar baru bagi siapa pun.
    announce = data.published && !existing.published;
    await db.assignment.update({ where: { id }, data: values });
  } else {
    await db.assignment.create({
      data: { ...values, batchId, allowedTypes: [] },
    });
  }

  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "assignment",
      entityId: id ?? batchId,
    },
  });

  if (announce)
    await notifyParticipants(batchId, {
      title: "Tugas baru",
      message: `${data.title} dibuka, batas waktu ${dateTime(data.dueAt)}.`,
      href: `/my-training/${batchId}/assignment`,
    });
}

export async function archiveAssignment(batchId: string, id: string) {
  const { user } = await requireBatchStaff(batchId);
  await db.assignment.updateMany({
    where: { id, batchId },
    data: { deletedAt: new Date(), published: false },
  });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "ARCHIVE",
      entity: "assignment",
      entityId: id,
    },
  });
}

/**
 * Satu pengumpulan adalah berkas yang diunggah atau sebuah tautan, tidak
 * keduanya sekaligus: dua rujukan pada satu tugas hanya menimbulkan pertanyaan
 * mana yang dinilai trainer.
 */
const submissionSchema = z
  .object({
    link: z.string().trim().max(2000).optional().default(""),
    storageKey: z.string().trim().max(500).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
  })
  .refine((value) => Boolean(value.link) !== Boolean(value.storageKey), {
    path: ["link"],
    message: "Unggah satu berkas atau isi satu tautan berkas.",
  })
  .refine((value) => !value.link || /^https?:\/\/\S+$/.test(value.link), {
    path: ["link"],
    message: "Gunakan tautan HTTP atau HTTPS.",
  });

/**
 * Pengumpulan tugas oleh peserta, berupa berkas yang diunggah ke penyimpanan
 * privat atau tautan ke drive perusahaan. Tautan tetap diterima karena tidak
 * setiap kantor mengizinkan berkasnya berpindah tempat, dan karena
 * penyimpanan yang belum dikonfigurasi tidak boleh menutup satu-satunya cara
 * peserta menyerahkan pekerjaannya.
 */
export async function submitAssignment(
  batchId: string,
  assignmentId: string,
  input: Record<string, unknown>,
) {
  const enrollment = await myEnrollment(batchId);
  const assignment = enrollment.batch.assignments.find(
    (item) => item.id === assignmentId,
  );
  if (!assignment) throw new Error("Tugas tidak tersedia pada training ini.");
  if (enrollment.batch.status === "COMPLETED")
    throw new Error("Training sudah ditutup.");

  const data = submissionSchema.parse(input);
  const existing = enrollment.submissions.find(
    (item) => item.assignmentId === assignmentId,
  );
  if (existing && existing.status === "COMPLETED")
    throw new Error("Tugas ini sudah dinyatakan selesai.");

  if (data.storageKey)
    await confirmUpload(
      data.storageKey,
      assignment.maxBytes,
      `batch/${batchId}/assignment/${assignmentId}/${enrollment.id}/`,
    );

  await db.assignmentSubmission.upsert({
    where: {
      assignmentId_enrollmentId: { assignmentId, enrollmentId: enrollment.id },
    },
    create: {
      assignmentId,
      enrollmentId: enrollment.id,
      link: data.link,
      storageKey: data.storageKey || null,
      notes: data.notes,
    },
    update: {
      link: data.link,
      storageKey: data.storageKey || null,
      notes: data.notes,
      status: "SUBMITTED",
      submittedAt: new Date(),
      score: null,
      feedback: null,
      reviewedBy: null,
      reviewedAt: null,
    },
  });

  // Berkas lama tidak dirujuk baris mana pun setelah penggantian ini.
  if (existing?.storageKey && existing.storageKey !== data.storageKey)
    await removeObject(existing.storageKey);

  await notifyBatchStaff(batchId, {
    title: "Tugas dikumpulkan",
    message: `${enrollment.participant.name} mengumpulkan ${assignment.title}.`,
    href: `/trainer/training/${batchId}/assignments`,
  });
}

const reviewSchema = z.object({
  status: z.enum(["REVIEWED", "REVISION_REQUIRED", "COMPLETED"]),
  score: z.coerce.number().min(0).max(1000).optional(),
  feedback: z.string().trim().max(2000).optional().default(""),
});

export async function reviewSubmission(
  batchId: string,
  submissionId: string,
  input: Record<string, unknown>,
) {
  const { user } = await requireBatchStaff(batchId);
  const data = reviewSchema.parse(input);

  const submission = await db.assignmentSubmission.findFirstOrThrow({
    where: { id: submissionId, assignment: { batchId } },
    include: { assignment: true, enrollment: true },
  });
  if (data.score !== undefined && data.score > submission.assignment.maxScore)
    throw new Error(
      `Nilai melebihi nilai maksimum tugas (${submission.assignment.maxScore}).`,
    );

  await db.assignmentSubmission.update({
    where: { id: submissionId },
    data: {
      status: data.status,
      score: data.score ?? null,
      feedback: data.feedback,
      reviewedBy: user.id,
      reviewedAt: new Date(),
    },
  });

  // Hasil pemeriksaan dikirim sebagai surel juga: peserta yang diminta merevisi
  // perlu tahu sebelum batas waktunya lewat, dan ia belum tentu membuka
  // aplikasi ini setiap hari.
  await notify(submission.enrollment.participantId, {
    title:
      data.status === "REVISION_REQUIRED"
        ? "Tugas perlu direvisi"
        : "Tugas sudah dinilai",
    message:
      data.status === "REVISION_REQUIRED"
        ? `${submission.assignment.title} perlu Anda perbaiki dan kumpulkan kembali.`
        : `${submission.assignment.title} telah diperiksa trainer.`,
    href: `/my-training/${batchId}/assignment/${submission.assignmentId}`,
    email: true,
  });
}

/* -------------------------------------------------------------------------
   Evaluasi pelatihan
   ------------------------------------------------------------------------- */

export async function openEvaluation(batchId: string) {
  const { user } = await requireBatchStaff(batchId);
  await db.trainingEvaluation.upsert({
    where: { batchId },
    create: {
      batchId,
      questions: EVALUATION_TEMPLATE as unknown as Prisma.InputJsonValue,
    },
    update: { open: true },
  });
  await db.auditLog.create({
    data: {
      actorId: user.id,
      action: "OPEN_EVALUATION",
      entity: "trainingEvaluation",
      entityId: batchId,
    },
  });
}

export async function closeEvaluation(batchId: string) {
  await requireBatchStaff(batchId);
  await db.trainingEvaluation.update({
    where: { batchId },
    data: { open: false },
  });
}

/**
 * Menyimpan jawaban evaluasi peserta. Sekali kirim: evaluasi yang dapat
 * diubah berulang kali menghilangkan makna angka rata-ratanya.
 */
export async function submitEvaluation(
  batchId: string,
  input: Record<string, unknown>,
) {
  const enrollment = await myEnrollment(batchId);
  const evaluation = enrollment.batch.evaluation;
  if (!evaluation) throw new Error("Evaluasi belum dibuka untuk training ini.");
  if (!evaluation.open) throw new Error("Evaluasi sudah ditutup.");
  if (enrollment.evaluations.length)
    throw new Error("Anda sudah mengisi evaluasi untuk training ini.");

  const questions = evaluation.questions as unknown as EvaluationQuestion[];
  const answers: Record<string, string | number> = {};

  for (const question of questions) {
    const raw = input[question.id];
    if (question.type === "RATING") {
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1 || value > 5)
        throw new Error("Beri penilaian 1 sampai 5 untuk setiap pernyataan.");
      answers[question.id] = value;
    } else {
      answers[question.id] = String(raw ?? "")
        .trim()
        .slice(0, 2000);
    }
  }

  await db.evaluationResponse.create({
    data: {
      evaluationId: evaluation.id,
      enrollmentId: enrollment.id,
      answers: answers as Prisma.InputJsonValue,
    },
  });
}

export type EvaluationSummary = {
  responses: number;
  ratings: { id: string; category: string; text: string; average: number }[];
  comments: string[];
  average: number;
};

/** Rekap evaluasi satu training. Komentar tidak menyertakan identitas penulis. */
export async function evaluationSummary(
  batchId: string,
): Promise<EvaluationSummary | null> {
  const evaluation = await db.trainingEvaluation.findUnique({
    where: { batchId },
    include: { responses: true },
  });
  if (!evaluation) return null;

  const questions = evaluation.questions as unknown as EvaluationQuestion[];
  const rows = evaluation.responses.map(
    (response) => response.answers as Record<string, string | number>,
  );

  const ratings = questions
    .filter((question) => question.type === "RATING")
    .map((question) => {
      const values = rows
        .map((row) => Number(row[question.id]))
        .filter((value) => Number.isFinite(value) && value > 0);
      return {
        id: question.id,
        category: question.category,
        text: question.text,
        average: values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0,
      };
    });

  const comments = questions
    .filter((question) => question.type === "TEXT")
    .flatMap((question) =>
      rows
        .map((row) => String(row[question.id] ?? "").trim())
        .filter((value) => value.length > 0),
    );

  const scored = ratings.filter((rating) => rating.average > 0);

  return {
    responses: evaluation.responses.length,
    ratings,
    comments,
    average: scored.length
      ? scored.reduce((sum, rating) => sum + rating.average, 0) / scored.length
      : 0,
  };
}

/* -------------------------------------------------------------------------
   Materi pendukung
   ------------------------------------------------------------------------- */

export const resourceSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional().default(""),
  url: z
    .url("Gunakan tautan HTTP atau HTTPS.")
    .refine(
      (value) => /^https?:\/\//.test(value),
      "Gunakan tautan HTTP atau HTTPS.",
    ),
});

export async function saveResource(
  batchId: string,
  input: Record<string, unknown>,
) {
  const { user } = await requireBatchStaff(batchId);
  const data = resourceSchema.parse(input);
  await db.trainingResource.create({
    data: { ...data, batchId, createdBy: user.id },
  });
}

const uploadedResourceSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional().default(""),
  storageKey: z.string().trim().min(1).max(500),
});

/**
 * Materi yang berkasnya diunggah ke penyimpanan privat. `url` dikosongkan:
 * berkas ini tidak punya alamat tetap yang boleh dibagikan — tautannya dibuat
 * per permintaan, setelah wewenang pembacanya diperiksa.
 */
export async function saveUploadedResource(
  batchId: string,
  input: Record<string, unknown>,
) {
  const { user } = await requireBatchStaff(batchId);
  const data = uploadedResourceSchema.parse(input);
  const info = await confirmUpload(
    data.storageKey,
    RESOURCE_MAX_BYTES,
    `batch/${batchId}/resource/`,
  );

  await db.trainingResource.create({
    data: {
      batchId,
      title: data.title,
      description: data.description,
      url: "",
      storageKey: data.storageKey,
      mimeType: mimeOf(fileNameOf(data.storageKey)) || info.mimeType,
      size: info.size,
      createdBy: user.id,
    },
  });

  await notifyParticipants(batchId, {
    title: "Materi baru dibagikan",
    message: `${data.title} tersedia pada halaman materi training Anda.`,
    href: `/my-training/${batchId}/resources`,
  });
}

export async function archiveResource(batchId: string, id: string) {
  await requireBatchStaff(batchId);
  await db.trainingResource.updateMany({
    where: { id, batchId },
    data: { deletedAt: new Date() },
  });
}

/** Tugas dan esai yang menunggu penilaian, dibatasi ke kelas milik pembaca. */
export async function pendingSubmissions() {
  const user = await currentUser();
  const admin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  return db.assignmentSubmission.findMany({
    where: {
      status: "SUBMITTED",
      assignment: {
        deletedAt: null,
        batch: {
          deletedAt: null,
          ...(admin ? {} : { trainers: { some: { trainerId: user.id } } }),
        },
      },
    },
    include: {
      assignment: { include: { batch: true } },
      enrollment: { include: { participant: true } },
    },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });
}
