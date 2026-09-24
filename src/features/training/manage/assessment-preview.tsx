"use client";

import { useEffect, useState, useTransition } from "react";
import { previewAssessmentAction } from "@/app/staff-actions";
import { Button } from "@/components/ui/button";
import { FormError, Note } from "@/components/ui/field";
import { AssessmentQuestions } from "@/features/learning/assessment-questions";
import type { VisibleQuestion } from "@/lib/grading";
import { minutes } from "@/lib/utils";

export function AssessmentPreview({
  batchId,
  assessment,
}: {
  batchId: string;
  assessment: {
    id: string;
    instructions: string;
    durationMinutes: number;
    passingGrade: number;
    maxAttempts: number;
    selection: string;
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
  };
}) {
  const [questions, setQuestions] = useState<VisibleQuestion[] | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    start(async () => {
      try {
        const result = await previewAssessmentAction(batchId, assessment.id);
        if (!active) return;
        if (result.questions) setQuestions(result.questions);
        else setError(result.error);
      } catch {
        if (active)
          setError(
            "Preview tidak dapat dimuat. Tutup lalu buka kembali untuk mencoba lagi.",
          );
      }
    });
    return () => {
      active = false;
    };
  }, [batchId, assessment.id]);

  return (
    <form onSubmit={(event) => event.preventDefault()} className="space-y-4">
      <p className="text-sm text-ink-600">
        {minutes(assessment.durationMinutes)} · lulus {assessment.passingGrade}{" "}
        · maks {assessment.maxAttempts}×
      </p>
      {assessment.instructions ? (
        <p className="whitespace-pre-line text-sm text-ink-700">
          {assessment.instructions}
        </p>
      ) : null}
      <Note>
        Preview pengerjaan tanpa penghitung waktu aktif dan tanpa mengurangi
        jatah percobaan.
        {assessment.selection === "RULES" ||
        assessment.randomizeQuestions ||
        assessment.randomizeOptions
          ? " Soal atau pilihan diacak sesuai pengaturan; paket peserta dapat berbeda."
          : " Soal mengikuti urutan dan batas jumlah yang tersimpan."}
      </Note>
      {pending || (!questions && !error) ? (
        <p role="status">Memuat soal…</p>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
      {questions ? (
        <>
          <p className="text-sm text-ink-600">
            {questions.length} soal · jawaban preview tidak disimpan
          </p>
          <AssessmentQuestions questions={questions} />
          <div className="flex justify-end">
            <Button type="submit" disabled>
              Kirim jawaban
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
