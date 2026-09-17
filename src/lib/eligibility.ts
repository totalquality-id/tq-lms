import type { AssessmentType, SubmissionStatus } from "@prisma/client";

import { bestScore } from "./grading";
import { attendanceRate } from "./progress";
import { dateLong, daysBetween } from "./utils";

export type Requirement = {
  label: string;
  met: boolean;
  detail: string;
};

export type Eligibility = {
  eligible: boolean;
  requirements: Requirement[];
};

/** Bentuk minimal yang dibutuhkan pemeriksaan kelulusan. */
export type EligibilityInput = {
  attendance: { status: string }[];
  attempts: {
    assessmentId: string;
    submittedAt: Date | null;
    score: number | null;
  }[];
  submissions: { assignmentId: string; status: SubmissionStatus }[];
  evaluations: unknown[];
  batch: {
    startDate: Date;
    endDate: Date;
    minimumAttendance: number;
    passingGrade: number | null;
    assessments: { id: string; type: AssessmentType; passingGrade: number }[];
    assignments: { id: string; required: boolean }[];
    evaluation: unknown | null;
  };
};

/**
 * Syarat sertifikat, dinyatakan satu per satu supaya administrator dapat
 * melihat persis mana yang belum terpenuhi — bukan sekadar "belum memenuhi
 * syarat". Syarat yang tidak berlaku pada suatu training (tidak ada ujian,
 * tidak ada tugas wajib) dianggap terpenuhi dan diberi keterangan, sehingga
 * tidak ada kelas yang mustahil diselesaikan hanya karena fiturnya tidak
 * dipakai.
 */
export function checkEligibility(enrollment: EligibilityInput): Eligibility {
  const { batch } = enrollment;
  const requirements: Requirement[] = [];

  const days = daysBetween(batch.startDate, batch.endDate).length;
  const rate = attendanceRate(enrollment.attendance, days);
  requirements.push({
    label: "Kehadiran",
    met: rate >= batch.minimumAttendance,
    detail: enrollment.attendance.length
      ? `${rate}% dari ${days} hari (minimum ${batch.minimumAttendance}%)`
      : "Presensi belum dicatat",
  });

  const finalExam = batch.assessments.find(
    (assessment) => assessment.type === "FINAL_EXAM",
  );
  if (finalExam) {
    const score = bestScore(
      enrollment.attempts.filter(
        (attempt) => attempt.assessmentId === finalExam.id,
      ),
    );
    const passing = batch.passingGrade ?? finalExam.passingGrade;
    requirements.push({
      label: "Ujian akhir",
      met: score !== null && score >= passing,
      detail:
        score === null
          ? "Belum ada nilai"
          : `Nilai ${Math.round(score)} (minimum ${passing})`,
    });
  } else {
    requirements.push({
      label: "Ujian akhir",
      met: true,
      detail: "Tidak ada ujian akhir pada training ini",
    });
  }

  const required = batch.assignments.filter(
    (assignment) => assignment.required,
  );
  if (required.length) {
    const done = required.filter((assignment) => {
      const submission = enrollment.submissions.find(
        (item) => item.assignmentId === assignment.id,
      );
      return (
        submission &&
        (submission.status === "REVIEWED" || submission.status === "COMPLETED")
      );
    }).length;
    requirements.push({
      label: "Tugas wajib",
      met: done === required.length,
      detail: `${done} dari ${required.length} tugas selesai dinilai`,
    });
  } else {
    requirements.push({
      label: "Tugas wajib",
      met: true,
      detail: "Tidak ada tugas wajib pada training ini",
    });
  }

  if (batch.evaluation) {
    requirements.push({
      label: "Evaluasi pelatihan",
      met: enrollment.evaluations.length > 0,
      detail: enrollment.evaluations.length ? "Sudah diisi" : "Belum diisi",
    });
  } else {
    requirements.push({
      label: "Evaluasi pelatihan",
      met: true,
      detail: "Evaluasi belum dibuka untuk training ini",
    });
  }

  return {
    eligible: requirements.every((requirement) => requirement.met),
    requirements,
  };
}

/**
 * Data yang dibekukan ke dalam sertifikat. Nama course atau organisasi yang
 * berubah setahun kemudian tidak boleh mengubah dokumen yang sudah diberikan
 * kepada peserta.
 */
export type CertificateSnapshot = {
  participant: string;
  participantEmail: string;
  course: string;
  courseCategory: string;
  training: string;
  trainingCode: string;
  organization: string | null;
  trainers: string[];
  startDate: string;
  endDate: string;
  durationHours: number;
  finalScore: number | null;
  attendanceRate: number;
};

/** Teks tanggal pelatihan untuk dokumen cetak. */
export function certificatePeriod(snapshot: CertificateSnapshot) {
  return snapshot.startDate === snapshot.endDate
    ? dateLong(snapshot.startDate)
    : `${dateLong(snapshot.startDate)} – ${dateLong(snapshot.endDate)}`;
}
