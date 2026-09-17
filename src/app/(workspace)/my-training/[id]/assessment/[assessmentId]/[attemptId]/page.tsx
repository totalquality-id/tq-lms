import { notFound, redirect } from "next/navigation";

import { AttemptRunner } from "@/features/learning/attempt-runner";
import { db } from "@/lib/db";
import { currentUser } from "@/services/access";
import { visibleQuestions, type SnapshotQuestion } from "@/services/assessment";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string; attemptId: string }>;
}) {
  const { id, assessmentId, attemptId } = await params;
  const user = await currentUser();

  const attempt = await db.assessmentAttempt.findFirst({
    where: {
      id: attemptId,
      assessmentId,
      enrollment: {
        batchId: id,
        participantId: user.id,
        deletedAt: null,
      },
    },
    include: { assessment: true },
  });
  if (!attempt) notFound();

  // Percobaan yang sudah dikirim tidak dibuka kembali: halaman hasil adalah
  // tempat yang benar, dan membiarkannya terbuka mengundang pengiriman kedua.
  if (attempt.submittedAt)
    redirect(`/my-training/${id}/assessment/${assessmentId}`);

  const snapshot = attempt.questionSnapshot as unknown as SnapshotQuestion[];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">
          {attempt.assessment.title}
        </h2>
        <p className="text-sm text-ink-500">
          Percobaan #{attempt.attemptNumber}
        </p>
      </div>
      <AttemptRunner
        batchId={id}
        assessmentId={assessmentId}
        attemptId={attemptId}
        expiresAt={attempt.expiresAt.toISOString()}
        questions={visibleQuestions(snapshot)}
      />
    </div>
  );
}
