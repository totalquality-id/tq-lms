"use server";

import { revalidatePath } from "next/cache";

import { failure } from "@/lib/action-result";
import type { FormState } from "@/schemas/forms";
import { gradeEssay } from "@/services/assessment";
import { issueCertificate, revokeCertificate } from "@/services/certificate";
import {
  archiveAssignment,
  archiveResource,
  closeEvaluation,
  markAttendance,
  openEvaluation,
  reviewSubmission,
  saveAssignment,
  saveResource,
} from "@/services/operations";
import {
  archiveAssessment,
  archiveQuestion,
  saveAssessment,
  saveQuestion,
  setAssessmentQuestions,
} from "@/services/question-bank";

function entries(form: FormData) {
  return Object.fromEntries(form) as Record<string, unknown>;
}

/* --------------------------------- Presensi -------------------------------- */

export async function attendanceAction(
  batchId: string,
  enrollmentId: string,
  date: string,
  status: string,
): Promise<FormState> {
  try {
    await markAttendance(batchId, { enrollmentId, date, status });
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Presensi tersimpan." };
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------- Tugas ---------------------------------- */

export async function assignmentAction(
  batchId: string,
  id: string | undefined,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await saveAssignment(batchId, id, entries(form));
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Tugas tersimpan." };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveAssignmentAction(
  batchId: string,
  id: string,
): Promise<FormState> {
  try {
    await archiveAssignment(batchId, id);
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Tugas diarsipkan." };
  } catch (error) {
    return failure(error);
  }
}

export async function reviewSubmissionAction(
  batchId: string,
  submissionId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await reviewSubmission(batchId, submissionId, entries(form));
    revalidatePath("/trainer/reviews");
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Penilaian tugas tersimpan." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------- Penilaian -------------------------------- */

export async function assessmentAction(
  batchId: string,
  id: string | undefined,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await saveAssessment(batchId, id, entries(form));
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Penilaian tersimpan." };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveAssessmentAction(
  batchId: string,
  id: string,
): Promise<FormState> {
  try {
    await archiveAssessment(batchId, id);
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Penilaian diarsipkan." };
  } catch (error) {
    return failure(error);
  }
}

export async function assessmentQuestionsAction(
  batchId: string,
  assessmentId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await setAssessmentQuestions(
      batchId,
      assessmentId,
      form.getAll("questionId").map((value) => String(value)),
    );
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Daftar soal diperbarui." };
  } catch (error) {
    return failure(error);
  }
}

export async function gradeEssayAction(
  answerId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await gradeEssay(
      answerId,
      Number(form.get("score")),
      String(form.get("feedback") ?? ""),
    );
    revalidatePath("/trainer/reviews");
    return { success: "Nilai esai tersimpan." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------- Bank soal -------------------------------- */

export async function questionAction(
  id: string | undefined,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await saveQuestion(id, entries(form));
    revalidatePath("/admin/question-bank");
    return { success: "Soal tersimpan." };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveQuestionAction(id: string): Promise<FormState> {
  try {
    await archiveQuestion(id);
    revalidatePath("/admin/question-bank");
    return { success: "Soal diarsipkan." };
  } catch (error) {
    return failure(error);
  }
}

/* --------------------------------- Evaluasi -------------------------------- */

export async function evaluationAction(
  batchId: string,
  open: boolean,
): Promise<FormState> {
  try {
    if (open) await openEvaluation(batchId);
    else await closeEvaluation(batchId);
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: open ? "Evaluasi dibuka." : "Evaluasi ditutup." };
  } catch (error) {
    return failure(error);
  }
}

/* ---------------------------------- Materi --------------------------------- */

export async function resourceAction(
  batchId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await saveResource(batchId, entries(form));
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Materi pendukung ditambahkan." };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveResourceAction(
  batchId: string,
  id: string,
): Promise<FormState> {
  try {
    await archiveResource(batchId, id);
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: "Materi dihapus dari daftar." };
  } catch (error) {
    return failure(error);
  }
}

/* -------------------------------- Sertifikat ------------------------------- */

export async function issueCertificateAction(
  batchId: string,
  enrollmentId: string,
): Promise<FormState> {
  try {
    const number = await issueCertificate(batchId, enrollmentId);
    revalidatePath("/admin/certificates");
    revalidatePath(`/trainer/training/${batchId}`, "layout");
    revalidatePath(`/admin/training/${batchId}`, "layout");
    return { success: `Sertifikat ${number} diterbitkan.` };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeCertificateAction(
  id: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await revokeCertificate(id, String(form.get("reason") ?? ""));
    revalidatePath("/admin/certificates");
    return { success: "Sertifikat dicabut." };
  } catch (error) {
    return failure(error);
  }
}
