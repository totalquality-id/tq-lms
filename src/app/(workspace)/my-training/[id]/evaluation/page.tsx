import { notFound } from "next/navigation";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { EvaluationForm } from "@/features/learning/evaluation-form";
import { myEnrollment } from "@/services/learning";
import type { EvaluationQuestion } from "@/services/operations";

export default async function EvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enrollment = await myEnrollment(id);
  const evaluation = enrollment.batch.evaluation;
  if (!evaluation) notFound();

  const answered = enrollment.evaluations.length > 0;
  const questions = evaluation.questions as unknown as EvaluationQuestion[];

  return (
    <Card>
      <CardHeader
        title={evaluation.title}
        description="Masukan Anda dipakai untuk memperbaiki pelatihan berikutnya."
      />
      <CardBody>
        {answered ? (
          <Note>
            Evaluasi Anda sudah tersimpan. Terima kasih telah meluangkan waktu.
          </Note>
        ) : !evaluation.open ? (
          <Note>Evaluasi untuk training ini sudah ditutup.</Note>
        ) : (
          <EvaluationForm batchId={id} questions={questions} />
        )}
      </CardBody>
    </Card>
  );
}
