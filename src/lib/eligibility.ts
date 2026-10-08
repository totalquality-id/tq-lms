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
    assessments: {
      id: string;
      title: string;
      type: AssessmentType;
      passingGrade: number;
      published: boolean;
    }[];
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

  const exams = finalExams(enrollment);
  if (exams.length) {
    const failed = exams.filter(
      (exam) => exam.score === null || exam.score < exam.passingGrade,
    );
    requirements.push({
      label: "Ujian akhir",
      met: failed.length === 0,
      detail: exams
        .map(
          (exam) =>
            `${exams.length > 1 ? `${exam.title}: ` : ""}${
              exam.score === null
                ? "Belum ada nilai"
                : `Nilai ${Math.round(exam.score)} (minimum ${exam.passingGrade})`
            }`,
        )
        .join("; "),
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
 * Ujian akhir yang menentukan kelulusan, beserta nilai terbaik peserta.
 *
 * Hanya ujian yang sudah terbit: ujian draft belum dapat dikerjakan peserta,
 * jadi tidak boleh menahan sertifikatnya. Nilai kelulusan yang berlaku adalah
 * milik ujian itu sendiri — angka yang sama dengan yang dilihat peserta di
 * halaman ujian dan yang menentukan status lulus percobaannya.
 */
export function finalExams(enrollment: Pick<EligibilityInput, "attempts" | "batch">) {
  return enrollment.batch.assessments
    .filter((assessment) => assessment.type === "FINAL_EXAM" && assessment.published)
    .map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      passingGrade: assessment.passingGrade,
      score: bestScore(
        enrollment.attempts.filter((attempt) => attempt.assessmentId === assessment.id),
      ),
    }));
}

/** Nilai ujian akhir yang dicetak di sertifikat: rata-rata bila lebih dari satu. */
export function finalScore(enrollment: Pick<EligibilityInput, "attempts" | "batch">) {
  const exams = finalExams(enrollment);
  if (!exams.length || exams.some((exam) => exam.score === null)) return null;
  return exams.reduce((sum, exam) => sum + (exam.score ?? 0), 0) / exams.length;
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
  /** Judul modul course; tidak ada pada sertifikat yang terbit sebelum template baru. */
  subjects?: string[];
};

/** Teks tanggal pelatihan untuk dokumen cetak. */
export function certificatePeriod(snapshot: CertificateSnapshot) {
  return snapshot.startDate === snapshot.endDate
    ? dateLong(snapshot.startDate)
    : `${dateLong(snapshot.startDate)} – ${dateLong(snapshot.endDate)}`;
}
