import type {
  AssessmentType,
  EnrollmentStatus,
  SubmissionStatus,
} from "@prisma/client";

export type ActivityKind =
  "LESSON" | "ASSESSMENT" | "ASSIGNMENT" | "EVALUATION";

export type Activity = {
  kind: ActivityKind;
  id: string;
  title: string;
  href: string;
  /** Wajib diselesaikan untuk memenuhi syarat kelulusan. */
  required: boolean;
  done: boolean;
  /** Terkunci karena aktivitas wajib sebelumnya belum selesai. */
  locked: boolean;
  detail?: string;
};

export type Progress = {
  activities: Activity[];
  requiredTotal: number;
  requiredDone: number;
  percent: number;
  next: Activity | null;
  lessonsDone: number;
  lessonsTotal: number;
};

/**
 * Bentuk minimal yang dibutuhkan perhitungan kemajuan. Ditulis struktural,
 * bukan sebagai tipe hasil query Prisma, supaya aturannya dapat diuji tanpa
 * basis data dan tanpa runtime server.
 */
export type ProgressInput = {
  status: EnrollmentStatus;
  lessons: { lessonId: string }[];
  attempts: {
    assessmentId: string;
    submittedAt: Date | null;
    score: number | null;
  }[];
  submissions: { assignmentId: string; status: SubmissionStatus }[];
  evaluations: unknown[];
  batch: {
    id: string;
    course: {
      sequential: boolean;
      modules: {
        title: string;
        lessons: { id: string; title: string; required: boolean }[];
      }[];
    };
    assessments: {
      id: string;
      type: AssessmentType;
      title: string;
      passingGrade: number;
    }[];
    assignments: { id: string; title: string; required: boolean }[];
    evaluation: { id: string; title: string } | null;
  };
};

const ASSESSMENT_ORDER: Record<AssessmentType, number> = {
  PRE_TEST: 0,
  QUIZ: 1,
  FINAL_EXAM: 2,
};

/**
 * Menyusun seluruh aktivitas menjadi satu urutan yang sama dengan alur
 * pelatihan: pre-test, materi, kuis, tugas, ujian akhir, lalu evaluasi.
 *
 * Persentase dihitung hanya dari aktivitas wajib — aktivitas tambahan tidak
 * boleh membuat peserta terlihat belum selesai padahal sudah memenuhi syarat
 * sertifikat.
 *
 * Penguncian berurutan mengikuti setelan course. Ketika mati, semuanya
 * terbuka; ketika hidup, satu aktivitas wajib yang belum selesai mengunci
 * semua yang sesudahnya.
 */
export function buildProgress(
  enrollment: ProgressInput,
  base = "/my-training",
): Progress {
  const { batch } = enrollment;
  const root = `${base}/${batch.id}`;
  const completedLessons = new Set(
    enrollment.lessons.map((lesson) => lesson.lessonId),
  );
  const activities: Activity[] = [];

  const assessments = [...batch.assessments].sort(
    (a, b) => ASSESSMENT_ORDER[a.type] - ASSESSMENT_ORDER[b.type],
  );

  const assessmentActivity = (
    assessment: ProgressInput["batch"]["assessments"][number],
  ): Activity => {
    const attempts = enrollment.attempts.filter(
      (attempt) => attempt.assessmentId === assessment.id,
    );
    const submitted = attempts.filter((attempt) => attempt.submittedAt);
    const best = submitted.reduce<number | null>(
      (top, attempt) =>
        attempt.score === null ? top : Math.max(top ?? 0, attempt.score),
      null,
    );
    return {
      kind: "ASSESSMENT",
      id: assessment.id,
      title: assessment.title,
      href: `${root}/assessment/${assessment.id}`,
      // Hanya ujian akhir yang menentukan kelulusan; pre-test dan kuis
      // membantu belajar tetapi tidak menahan sertifikat.
      required: assessment.type === "FINAL_EXAM",
      done:
        assessment.type === "FINAL_EXAM"
          ? best !== null && best >= assessment.passingGrade
          : submitted.length > 0,
      locked: false,
      detail: best === null ? undefined : `Nilai ${Math.round(best)}`,
    };
  };

  for (const assessment of assessments.filter((a) => a.type === "PRE_TEST"))
    activities.push(assessmentActivity(assessment));

  for (const courseModule of batch.course.modules)
    for (const lesson of courseModule.lessons)
      activities.push({
        kind: "LESSON",
        id: lesson.id,
        title: lesson.title,
        href: `${root}/learn/${lesson.id}`,
        required: lesson.required,
        done: completedLessons.has(lesson.id),
        locked: false,
        detail: courseModule.title,
      });

  for (const assessment of assessments.filter((a) => a.type === "QUIZ"))
    activities.push(assessmentActivity(assessment));

  for (const assignment of batch.assignments) {
    const submission = enrollment.submissions.find(
      (item) => item.assignmentId === assignment.id,
    );
    activities.push({
      kind: "ASSIGNMENT",
      id: assignment.id,
      title: assignment.title,
      href: `${root}/assignment/${assignment.id}`,
      required: assignment.required,
      done:
        submission !== undefined && submission.status !== "REVISION_REQUIRED",
      locked: false,
      detail: submission ? undefined : "Belum dikumpulkan",
    });
  }

  for (const assessment of assessments.filter((a) => a.type === "FINAL_EXAM"))
    activities.push(assessmentActivity(assessment));

  if (batch.evaluation)
    activities.push({
      kind: "EVALUATION",
      id: batch.evaluation.id,
      title: batch.evaluation.title,
      href: `${root}/evaluation`,
      required: true,
      done: enrollment.evaluations.length > 0,
      locked: false,
    });

  if (batch.course.sequential) {
    let blocked = false;
    for (const activity of activities) {
      activity.locked = blocked;
      if (activity.required && !activity.done) blocked = true;
    }
  }

  const required = activities.filter((activity) => activity.required);
  const requiredDone = required.filter((activity) => activity.done).length;
  const lessons = activities.filter((activity) => activity.kind === "LESSON");

  return {
    activities,
    requiredTotal: required.length,
    requiredDone,
    percent: required.length
      ? Math.round((requiredDone / required.length) * 100)
      : 0,
    next:
      activities.find((activity) => !activity.done && !activity.locked) ?? null,
    lessonsDone: lessons.filter((lesson) => lesson.done).length,
    lessonsTotal: lessons.length,
  };
}

/**
 * Persentase kehadiran. Izin tidak dihitung memberatkan maupun meringankan:
 * hari itu dikeluarkan dari penyebut, bukan dihitung sebagai ketidakhadiran.
 */
export function attendanceRate(
  records: { status: string }[],
  scheduledDays: number,
) {
  const counted = records.filter((record) => record.status !== "EXCUSED");
  const excused = records.length - counted.length;
  const denominator = Math.max(0, scheduledDays - excused);
  if (denominator === 0) return records.length ? 100 : 0;
  const present = counted.filter(
    (record) => record.status === "PRESENT" || record.status === "LATE",
  ).length;
  return Math.round((present / denominator) * 100);
}
