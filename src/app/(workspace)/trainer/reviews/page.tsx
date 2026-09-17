import type { Metadata } from "next";
import Link from "next/link";

import { gradeEssayAction, reviewSubmissionAction } from "@/app/staff-actions";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { reviewFields } from "@/features/management/staff-fields";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/utils";
import { currentUser } from "@/services/access";
import { pendingReviews, type SnapshotQuestion } from "@/services/assessment";
import { pendingSubmissions } from "@/services/operations";

export const metadata: Metadata = { title: "Penilaian" };

/**
 * Antrean pekerjaan penilaian. Esai dan tugas disatukan di sini supaya trainer
 * punya satu tempat untuk memeriksa, bukan harus membuka setiap kelas satu per
 * satu untuk mencari yang tertunggak.
 */
export default async function ReviewsPage() {
  const user = await currentUser();
  const admin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const [submissions, attempts] = await Promise.all([
    pendingSubmissions(),
    pendingReviews(user.id, admin),
  ]);

  // Jawaban esai yang belum dinilai, diambil bersama soalnya dari snapshot.
  const answers = await db.assessmentAnswer.findMany({
    where: {
      attemptId: { in: attempts.map((attempt) => attempt.id) },
      score: null,
    },
  });

  const essays = answers.flatMap((answer) => {
    const attempt = attempts.find((item) => item.id === answer.attemptId);
    if (!attempt) return [];
    const snapshot = attempt.questionSnapshot as unknown as SnapshotQuestion[];
    const question = snapshot.find((item) => item.id === answer.questionId);
    if (!question || question.type !== "ESSAY") return [];
    return [{ answer, attempt, question }];
  });

  const empty = !submissions.length && !essays.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Penilaian"
        description="Tugas dan jawaban esai yang menunggu pemeriksaan Anda."
      />

      {empty ? (
        <Card>
          <EmptyState
            title="Tidak ada yang menunggu"
            description="Seluruh tugas dan esai pada kelas Anda sudah dinilai."
          />
        </Card>
      ) : null}

      {essays.length ? (
        <section>
          <SectionHeader
            title="Jawaban esai"
            description="Nilai akhir percobaan dihitung ulang setelah seluruh esainya dinilai."
          />
          <Card>
            <ul className="divide-y divide-ink-100">
              {essays.map(({ answer, attempt, question }) => (
                <li key={answer.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">
                        {attempt.enrollment.participant.name}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {attempt.assessment.batch.title} ·{" "}
                        {attempt.assessment.title} · percobaan #
                        {attempt.attemptNumber} ·{" "}
                        {attempt.submittedAt
                          ? dateTime(attempt.submittedAt)
                          : "—"}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-800">
                        {question.text}
                      </p>
                      <blockquote className="mt-2 border-l-2 border-ink-300 pl-3 text-sm leading-relaxed whitespace-pre-line text-ink-600">
                        {typeof answer.answer === "string"
                          ? answer.answer
                          : JSON.stringify(answer.answer)}
                      </blockquote>
                    </div>
                    <DialogForm
                      action={gradeEssayAction.bind(null, answer.id)}
                      title="Nilai jawaban esai"
                      description={`Bobot soal ${question.points} poin.`}
                      fields={[
                        {
                          name: "score",
                          label: `Nilai (0–${question.points})`,
                          type: "number",
                          required: true,
                          min: 0,
                          max: question.points,
                        },
                        {
                          name: "feedback",
                          label: "Umpan balik",
                          type: "textarea",
                          full: true,
                        },
                      ]}
                      trigger="Nilai"
                      triggerVariant="secondary"
                      triggerSize="sm"
                      submitLabel="Simpan nilai"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {submissions.length ? (
        <section>
          <SectionHeader
            title="Tugas"
            description="Buka tautan berkasnya sebelum memberi nilai."
          />
          <Card>
            <ul className="divide-y divide-ink-100">
              {submissions.map((submission) => (
                <li
                  key={submission.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {submission.enrollment.participant.name}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      <Link
                        href={`/trainer/training/${submission.assignment.batchId}/assignments`}
                        className="hover:text-brand-600 hover:underline"
                      >
                        {submission.assignment.batch.title}
                      </Link>{" "}
                      · {submission.assignment.title} ·{" "}
                      {dateTime(submission.submittedAt)}
                    </p>
                    {submission.notes ? (
                      <p className="mt-1 text-xs leading-relaxed text-ink-600">
                        {submission.notes}
                      </p>
                    ) : null}
                  </div>
                  <a
                    href={submission.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:underline"
                  >
                    Buka berkas
                  </a>
                  <DialogForm
                    action={reviewSubmissionAction.bind(
                      null,
                      submission.assignment.batchId,
                      submission.id,
                    )}
                    title="Nilai tugas"
                    description={`${submission.enrollment.participant.name} — ${submission.assignment.title}`}
                    fields={reviewFields(
                      submission.assignment.maxScore,
                      submission,
                    )}
                    trigger="Nilai"
                    triggerVariant="secondary"
                    triggerSize="sm"
                    submitLabel="Simpan penilaian"
                  />
                </li>
              ))}
            </ul>
            <CardBody className="border-t border-ink-200">
              <p className="text-xs text-ink-500">
                Menandai tugas &ldquo;Perlu revisi&rdquo; mengembalikannya ke
                peserta untuk dikumpulkan ulang.
              </p>
            </CardBody>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
