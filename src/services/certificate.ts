import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { checkEligibility, type CertificateSnapshot } from "@/lib/eligibility";
import { bestScore } from "@/lib/grading";
import { attendanceRate } from "@/lib/progress";
import { dateInput, daysBetween } from "@/lib/utils";
import { requireAdmin, requireBatchStaff } from "./access";
import { notify } from "./notification";

// Aturan kelulusan adalah logika murni dan tinggal di lib, agar dapat diuji
// tanpa basis data.
export { certificatePeriod, checkEligibility } from "@/lib/eligibility";
export type {
  CertificateSnapshot,
  Eligibility,
  Requirement,
} from "@/lib/eligibility";

/** Bentuk data pendaftaran yang dibutuhkan pemeriksaan kelulusan. */
export const eligibilityInclude = {
  participant: true,
  attendance: true,
  attempts: { include: { assessment: true } },
  submissions: { include: { assignment: true } },
  evaluations: true,
  certificate: true,
  batch: {
    include: {
      course: true,
      organization: true,
      trainers: { include: { trainer: true } },
      assessments: { where: { deletedAt: null } },
      assignments: { where: { deletedAt: null, published: true } },
      evaluation: true,
    },
  },
} satisfies Prisma.EnrollmentInclude;

export type EligibilityEnrollment = Prisma.EnrollmentGetPayload<{
  include: typeof eligibilityInclude;
}>;

/**
 * Nomor sertifikat: TQI-<KODE COURSE>-<TAHUN>-<urutan enam digit>. Urutan
 * disimpan pada barisnya sendiri dan hanya pernah bertambah, sehingga nomor
 * yang pernah terbit tidak dapat dipakai ulang setelah pencabutan.
 */
async function nextNumber(
  tx: Prisma.TransactionClient,
  courseCode: string,
  year: number,
) {
  const scope = `${courseCode}-${year}`;
  const counter = await tx.certificateSequence.upsert({
    where: { scope },
    create: { scope, last: 1 },
    update: { last: { increment: 1 } },
  });
  return `TQI-${courseCode}-${year}-${String(counter.last).padStart(6, "0")}`;
}

/**
 * Menerbitkan sertifikat. Data yang dicetak dibekukan sebagai snapshot: nama
 * course atau organisasi yang berubah setahun kemudian tidak boleh mengubah
 * dokumen yang sudah diberikan kepada peserta.
 */
export async function issueCertificate(batchId: string, enrollmentId: string) {
  const { user } = await requireBatchStaff(batchId);

  return db.$transaction(
    async (tx) => {
      const enrollment = await tx.enrollment.findFirstOrThrow({
        where: { id: enrollmentId, batchId, deletedAt: null },
        include: eligibilityInclude,
      });

      const existing = await tx.certificate.findUnique({
        where: { enrollmentId },
      });
      if (existing && existing.status === "ISSUED")
        throw new Error("Sertifikat untuk peserta ini sudah diterbitkan.");

      const { eligible, requirements } = checkEligibility(enrollment);
      if (!eligible)
        throw new Error(
          `Syarat belum terpenuhi: ${requirements
            .filter((requirement) => !requirement.met)
            .map((requirement) => requirement.label.toLowerCase())
            .join(", ")}.`,
        );

      const { batch } = enrollment;
      const finalExam = batch.assessments.find(
        (assessment) => assessment.type === "FINAL_EXAM",
      );
      const score = finalExam
        ? bestScore(
            enrollment.attempts.filter(
              (attempt) => attempt.assessmentId === finalExam.id,
            ),
          )
        : null;

      const snapshot: CertificateSnapshot = {
        participant: enrollment.participant.name,
        participantEmail: enrollment.participant.email,
        course: batch.course.title,
        courseCategory: batch.course.category,
        training: batch.title,
        trainingCode: batch.code,
        organization: batch.organization?.name ?? null,
        trainers: batch.trainers.map((link) => link.trainer.name),
        startDate: dateInput(batch.startDate),
        endDate: dateInput(batch.endDate),
        durationHours: batch.course.duration,
        finalScore: score === null ? null : Math.round(score),
        attendanceRate: attendanceRate(
          enrollment.attendance,
          daysBetween(batch.startDate, batch.endDate).length,
        ),
      };

      const number =
        existing?.number ??
        (await nextNumber(
          tx,
          batch.course.code,
          new Date(batch.endDate).getFullYear(),
        ));

      const certificate = await tx.certificate.upsert({
        where: { enrollmentId },
        create: {
          number,
          enrollmentId,
          status: "ISSUED",
          issuedAt: new Date(),
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          createdBy: user.id,
        },
        update: {
          status: "ISSUED",
          issuedAt: new Date(),
          revokedAt: null,
          revokedReason: null,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          updatedBy: user.id,
        },
      });

      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "ISSUE_CERTIFICATE",
          entity: "certificate",
          entityId: certificate.id,
          metadata: { number: certificate.number },
        },
      });

      await notify(
        enrollment.participantId,
        {
          title: "Sertifikat diterbitkan",
          message: `Sertifikat ${certificate.number} untuk ${batch.title} telah tersedia dan dapat Anda unduh.`,
          href: "/certificates",
          email: true,
        },
        tx,
      );

      return certificate.number;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function revokeCertificate(id: string, reason: string) {
  const user = await requireAdmin();
  const trimmed = reason.trim();
  if (trimmed.length < 5)
    throw new Error("Tuliskan alasan pencabutan minimal 5 karakter.");

  await db.$transaction(async (tx) => {
    const certificate = await tx.certificate.findUniqueOrThrow({
      where: { id },
    });
    if (certificate.status === "REVOKED")
      throw new Error("Sertifikat ini sudah dicabut.");

    await tx.certificate.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: trimmed.slice(0, 500),
        updatedBy: user.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "REVOKE_CERTIFICATE",
        entity: "certificate",
        entityId: id,
        metadata: { number: certificate.number, reason: trimmed.slice(0, 500) },
      },
    });
  });
}

/**
 * Data yang boleh dilihat publik pada halaman verifikasi. Email peserta,
 * nilai, dan tingkat kehadiran sengaja tidak disertakan: yang perlu
 * dibuktikan adalah keaslian dokumen, bukan isi rapor seseorang.
 */
export async function verifyCertificate(number: string) {
  const certificate = await db.certificate.findUnique({
    where: { number: number.trim().toUpperCase() },
    select: {
      number: true,
      status: true,
      issuedAt: true,
      revokedAt: true,
      snapshot: true,
    },
  });
  if (!certificate || certificate.status === "DRAFT") return null;

  const snapshot = certificate.snapshot as unknown as CertificateSnapshot;
  return {
    number: certificate.number,
    valid: certificate.status === "ISSUED",
    issuedAt: certificate.issuedAt,
    revokedAt: certificate.revokedAt,
    participant: snapshot.participant,
    course: snapshot.course,
    organization: snapshot.organization,
    trainingStart: snapshot.startDate,
    trainingEnd: snapshot.endDate,
    trainers: snapshot.trainers,
    durationHours: snapshot.durationHours,
  };
}
