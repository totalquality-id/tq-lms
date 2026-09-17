"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { failure } from "@/lib/action-result";
import type { FormState } from "@/schemas/forms";
import { startAttempt, submitAttempt } from "@/services/assessment";
import { completeLesson, uncompleteLesson } from "@/services/learning";
import { submitAssignment, submitEvaluation } from "@/services/operations";

/** Menandai atau membatalkan penyelesaian satu pelajaran. */
export async function lessonAction(
  batchId: string,
  lessonId: string,
  done: boolean,
): Promise<FormState> {
  try {
    if (done) await completeLesson(batchId, lessonId);
    else await uncompleteLesson(batchId, lessonId);
    revalidatePath(`/my-training/${batchId}`, "layout");
    return {
      success: done ? "Pelajaran ditandai selesai." : "Tanda selesai dibatalkan.",
    };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Memulai percobaan lalu mengarahkan ke halaman pengerjaan. Pengalihan
 * dilakukan di luar blok try: `redirect` bekerja dengan melempar, dan
 * menangkapnya di sini akan berubah menjadi pesan galat palsu.
 */
export async function startAttemptAction(
  batchId: string,
  assessmentId: string,
): Promise<FormState> {
  let attemptId: string;
  try {
    attemptId = await startAttempt(batchId, assessmentId);
  } catch (error) {
    return failure(error);
  }
  redirect(`/my-training/${batchId}/assessment/${assessmentId}/${attemptId}`);
}

export async function submitAttemptAction(
  batchId: string,
  assessmentId: string,
  attemptId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const answers: Record<string, string | string[]> = {};
    for (const key of new Set(form.keys())) {
      if (!key.startsWith("q:")) continue;
      const values = form
        .getAll(key)
        .map((value) => String(value))
        .filter((value) => value.length > 0);
      if (!values.length) continue;
      answers[key.slice(2)] = values.length > 1 ? values : values[0];
    }
    const result = await submitAttempt(batchId, attemptId, answers);
    revalidatePath(`/my-training/${batchId}`, "layout");
    return {
      success: result.expired
        ? "Waktu pengerjaan telah habis. Jawaban yang sempat tersimpan tetap dinilai."
        : "Jawaban berhasil dikirim.",
      redirectTo: `/my-training/${batchId}/assessment/${assessmentId}`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function submitAssignmentAction(
  batchId: string,
  assignmentId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await submitAssignment(
      batchId,
      assignmentId,
      Object.fromEntries(form) as Record<string, unknown>,
    );
    revalidatePath(`/my-training/${batchId}`, "layout");
    return { success: "Tugas berhasil dikumpulkan." };
  } catch (error) {
    return failure(error);
  }
}

export async function submitEvaluationAction(
  batchId: string,
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    await submitEvaluation(
      batchId,
      Object.fromEntries(form) as Record<string, unknown>,
    );
    revalidatePath(`/my-training/${batchId}`, "layout");
    return { success: "Terima kasih, evaluasi Anda telah tersimpan." };
  } catch (error) {
    return failure(error);
  }
}
