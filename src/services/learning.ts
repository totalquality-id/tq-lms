import "server-only";

import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { buildProgress } from "@/lib/progress";
import { currentUser } from "./access";

// Aturan kemajuan dan kehadiran adalah logika murni dan tinggal di lib, agar
// dapat diuji tanpa basis data. Diekspor ulang di sini supaya pemanggil tetap
// mengambil seluruh kebutuhan belajarnya dari satu modul.
export { attendanceRate, buildProgress } from "@/lib/progress";
export type { Activity, ActivityKind, Progress } from "@/lib/progress";

/**
 * Satu bentuk data untuk seluruh pengalaman belajar peserta: kurikulum,
 * penilaian, tugas, evaluasi, dan apa saja yang sudah diselesaikan. Dibaca
 * sekali lalu dipakai bersama oleh perhitungan kemajuan dan halaman training,
 * supaya keduanya tidak pernah menampilkan angka yang berbeda.
 */
export const enrollmentInclude = {
  participant: true,
  batch: {
    include: {
      organization: true,
      trainers: { include: { trainer: true } },
      course: {
        include: {
          modules: {
            orderBy: { position: "asc" as const },
            include: { lessons: { orderBy: { position: "asc" as const } } },
          },
        },
      },
      assessments: {
        where: { deletedAt: null, published: true },
        orderBy: { type: "asc" as const },
      },
      assignments: {
        where: { deletedAt: null, published: true },
        orderBy: { dueAt: "asc" as const },
      },
      resources: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" as const },
      },
      evaluation: true,
    },
  },
  lessons: true,
  attempts: { orderBy: { attemptNumber: "asc" as const } },
  submissions: true,
  evaluations: true,
  attendance: { orderBy: { date: "asc" as const } },
  certificate: true,
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentDetail = Prisma.EnrollmentGetPayload<{
  include: typeof enrollmentInclude;
}>;

/**
 * Memuat pendaftaran peserta yang sedang masuk. Peserta hanya boleh membuka
 * pendaftarannya sendiri; pemeriksaan dilakukan di klausa query, bukan dengan
 * menyembunyikan tautan.
 */
export async function myEnrollment(batchId: string): Promise<EnrollmentDetail> {
  const user = await currentUser();
  const enrollment = await db.enrollment.findFirst({
    where: {
      batchId,
      participantId: user.id,
      deletedAt: null,
      status: { not: "CANCELLED" },
      batch: { deletedAt: null },
    },
    include: enrollmentInclude,
  });
  if (!enrollment) notFound();
  return enrollment;
}

/**
 * Menandai satu pelajaran selesai. Idempoten: menandai ulang tidak membuat
 * baris ganda dan tidak menggeser waktu penyelesaian pertama.
 */
export async function completeLesson(batchId: string, lessonId: string) {
  const enrollment = await myEnrollment(batchId);
  if (enrollment.batch.status === "COMPLETED")
    throw new Error("Training sudah ditutup.");

  const progress = buildProgress(enrollment);
  const activity = progress.activities.find(
    (item) => item.kind === "LESSON" && item.id === lessonId,
  );
  if (!activity) throw new Error("Pelajaran tidak tersedia pada training ini.");
  if (activity.locked)
    throw new Error("Selesaikan aktivitas sebelumnya terlebih dahulu.");

  await db.lessonCompletion.upsert({
    where: {
      enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
    },
    create: { enrollmentId: enrollment.id, lessonId },
    update: {},
  });

  // Pendaftaran berpindah ke "sedang belajar" pada aktivitas pertama, sehingga
  // administrator melihat kelas benar-benar berjalan tanpa perlu bertanya.
  if (enrollment.status === "ENROLLED" || enrollment.status === "INVITED")
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "IN_PROGRESS" },
    });
}

/** Membatalkan penandaan selesai, untuk peserta yang keliru menekan tombol. */
export async function uncompleteLesson(batchId: string, lessonId: string) {
  const enrollment = await myEnrollment(batchId);
  if (enrollment.batch.status === "COMPLETED")
    throw new Error("Training sudah ditutup.");
  await db.lessonCompletion.deleteMany({
    where: { enrollmentId: enrollment.id, lessonId },
  });
}
