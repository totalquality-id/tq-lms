import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { bestScore } from "@/lib/grading";
import { batchScope } from "@/lib/policy";
import { attendanceRate } from "@/lib/progress";
import { calendarKey, date, daysBetween, labels } from "@/lib/utils";
import { currentUser } from "./access";

export { toCsv } from "@/lib/csv";
export type { ReportTable } from "@/lib/csv";
import type { ReportTable } from "@/lib/csv";

export const REPORT_KINDS = [
  "training",
  "participants",
  "attendance",
  "assessment",
  "evaluation",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_LABEL: Record<ReportKind, string> = {
  training: "Rekap training",
  participants: "Hasil peserta",
  attendance: "Presensi",
  assessment: "Penilaian",
  evaluation: "Evaluasi pelatihan",
};

const detailInclude = {
  course: true,
  organization: true,
  trainers: { include: { trainer: true } },
  assessments: { where: { deletedAt: null } },
  assignments: { where: { deletedAt: null, published: true } },
  evaluation: { include: { responses: true } },
  enrollments: {
    where: { deletedAt: null, status: { not: "CANCELLED" as const } },
    include: {
      participant: true,
      attendance: true,
      attempts: true,
      submissions: true,
      evaluations: true,
      certificate: true,
      lessons: true,
    },
    orderBy: { participant: { name: "asc" as const } },
  },
} satisfies Prisma.TrainingBatchInclude;

/**
 * Laporan selalu dibangun dari lingkup peran pembaca. Administrator melihat
 * seluruh training, trainer hanya kelasnya, PIC hanya organisasinya — aturan
 * yang sama dengan daftar training, sehingga ekspor tidak pernah menjadi
 * jalan pintas untuk membaca data milik orang lain.
 */
export async function buildReport(
  kind: ReportKind,
  filters: { batchId?: string; from?: string; to?: string },
): Promise<ReportTable> {
  const user = await currentUser();

  // Lingkup batch saja tidak cukup untuk peserta: kelas yang mereka ikuti juga
  // memuat seluruh teman sekelasnya, sehingga ekspor akan membocorkan nama,
  // email, dan nilai orang lain. Pelaporan memang bukan untuk peserta — rekam
  // pribadi mereka ada di halaman Riwayat pelatihan.
  if (user.role === "PARTICIPANT")
    throw new Error("Laporan hanya tersedia untuk staf dan PIC perusahaan.");

  const where: Prisma.TrainingBatchWhereInput = {
    AND: [
      batchScope(user),
      filters.batchId ? { id: filters.batchId } : {},
      filters.from
        ? { startDate: { gte: new Date(`${filters.from}T00:00:00+07:00`) } }
        : {},
      filters.to
        ? { startDate: { lte: new Date(`${filters.to}T23:59:59+07:00`) } }
        : {},
    ],
  };

  const batches = await db.trainingBatch.findMany({
    where,
    include: detailInclude,
    orderBy: { startDate: "desc" },
    take: 200,
  });

  if (kind === "training")
    return {
      title: REPORT_LABEL.training,
      columns: [
        "Kode",
        "Training",
        "Course",
        "Organisasi",
        "Mulai",
        "Selesai",
        "Metode",
        "Status",
        "Trainer",
        "Peserta",
        "Sertifikat terbit",
      ],
      rows: batches.map((batch) => [
        batch.code,
        batch.title,
        batch.course.title,
        batch.organization?.name ?? "Training umum",
        date(batch.startDate),
        date(batch.endDate),
        labels[batch.mode] ?? batch.mode,
        labels[batch.status] ?? batch.status,
        batch.trainers.map((link) => link.trainer.name).join(", ") || "—",
        batch.enrollments.length,
        batch.enrollments.filter(
          (enrollment) => enrollment.certificate?.status === "ISSUED",
        ).length,
      ]),
    };

  if (kind === "participants")
    return {
      title: REPORT_LABEL.participants,
      columns: [
        "Training",
        "Peserta",
        "Email",
        "Organisasi",
        "Pre-Test",
        "Ujian akhir",
        "Kehadiran",
        "Tugas selesai",
        "Status",
        "Sertifikat",
      ],
      rows: batches.flatMap((batch) => {
        const days = daysBetween(batch.startDate, batch.endDate).length;
        const pre = batch.assessments.find((item) => item.type === "PRE_TEST");
        const final = batch.assessments.find(
          (item) => item.type === "FINAL_EXAM",
        );
        const requiredAssignments = batch.assignments.filter(
          (assignment) => assignment.required,
        );
        return batch.enrollments.map((enrollment) => {
          const preScore = pre
            ? bestScore(
                enrollment.attempts.filter(
                  (attempt) => attempt.assessmentId === pre.id,
                ),
              )
            : null;
          const finalScore = final
            ? bestScore(
                enrollment.attempts.filter(
                  (attempt) => attempt.assessmentId === final.id,
                ),
              )
            : null;
          const done = requiredAssignments.filter((assignment) => {
            const submission = enrollment.submissions.find(
              (item) => item.assignmentId === assignment.id,
            );
            return (
              submission &&
              (submission.status === "REVIEWED" ||
                submission.status === "COMPLETED")
            );
          }).length;
          return [
            batch.title,
            enrollment.participant.name,
            enrollment.participant.email,
            batch.organization?.name ?? "—",
            preScore === null ? "—" : Math.round(preScore),
            finalScore === null ? "—" : Math.round(finalScore),
            `${attendanceRate(enrollment.attendance, days)}%`,
            requiredAssignments.length
              ? `${done}/${requiredAssignments.length}`
              : "—",
            labels[enrollment.status] ?? enrollment.status,
            enrollment.certificate?.status === "ISSUED"
              ? enrollment.certificate.number
              : "—",
          ];
        });
      }),
    };

  if (kind === "attendance")
    return {
      title: REPORT_LABEL.attendance,
      columns: [
        "Training",
        "Peserta",
        "Tanggal",
        "Status",
      ],
      rows: batches.flatMap((batch) =>
        batch.enrollments.flatMap((enrollment) =>
          enrollment.attendance.map((record) => [
            batch.title,
            enrollment.participant.name,
            calendarKey(record.date),
            labels[record.status] ?? record.status,
          ]),
        ),
      ),
    };

  if (kind === "assessment")
    return {
      title: REPORT_LABEL.assessment,
      columns: [
        "Training",
        "Penilaian",
        "Jenis",
        "Peserta",
        "Percobaan",
        "Nilai",
        "Hasil",
        "Dikirim",
      ],
      rows: batches.flatMap((batch) =>
        batch.enrollments.flatMap((enrollment) =>
          enrollment.attempts
            .filter((attempt) => attempt.submittedAt)
            .map((attempt) => {
              const assessment = batch.assessments.find(
                (item) => item.id === attempt.assessmentId,
              );
              return [
                batch.title,
                assessment?.title ?? "—",
                assessment ? (labels[assessment.type] ?? assessment.type) : "—",
                enrollment.participant.name,
                attempt.attemptNumber,
                attempt.score === null ? "Menunggu penilaian" : Math.round(attempt.score),
                attempt.passed === null
                  ? "—"
                  : attempt.passed
                    ? "Lulus"
                    : "Belum lulus",
                attempt.submittedAt ? date(attempt.submittedAt) : "—",
              ];
            }),
        ),
      ),
    };

  return {
    title: REPORT_LABEL.evaluation,
    columns: [
      "Training",
      "Organisasi",
      "Peserta",
      "Responden",
      "Rata-rata (1–5)",
    ],
    rows: batches
      .filter((batch) => batch.evaluation)
      .map((batch) => {
        const rows = (batch.evaluation?.responses ?? []).map(
          (response) => response.answers as Record<string, string | number>,
        );
        const values = rows.flatMap((row) =>
          Object.values(row)
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5),
        );
        const average = values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0;
        return [
          batch.title,
          batch.organization?.name ?? "—",
          batch.enrollments.length,
          rows.length,
          average ? average.toFixed(2) : "—",
        ];
      }),
  };
}
