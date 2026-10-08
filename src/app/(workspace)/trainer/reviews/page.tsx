import type { Metadata } from "next";
import Link from "@/components/ui/navigation-link";

import { reviewAnswerAction, reviewSubmissionAction } from "@/app/staff-actions";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { reviewFields } from "@/features/management/staff-fields";
import { db } from "@/lib/db";
import { dateTime } from "@/lib/utils";
import { currentUser } from "@/services/access";
import { pendingReviews, type SnapshotQuestion } from "@/services/assessment";
import { answerParts, isAnswerable, questionNumbers } from "@/lib/grading";
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

  // Jawaban yang belum dinilai, diambil bersama soalnya dari snapshot. Selain
  // esai, ini juga menampung jawaban lama dari masa ketika pilihan ganda dan
  // isian singkat masih dinilai manual.
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
    if (!question || !isAnswerable(question)) return [];
    const parent = question.parentId
      ? snapshot.find((item) => item.id === question.parentId)
      : undefined;
    const number = questionNumbers(snapshot).get(question.id);
    return [{ answer, attempt, question, parent, number }];
  });

  const empty = !submissions.length && !essays.length;

  function FormatAnswer({ answer, question }: { answer: unknown; question: SnapshotQuestion }) {
    const { answer: value, reason } = answerParts(answer);
    const values = Array.isArray(value) ? value : [value];
    const text = question.options.length
      ? values.map((item) => question.options.find((option) => option.id === item)?.text ?? String(item))
      : values.map(String);
    return (
      <>
        {text.length > 1 ? (
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {text.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        ) : (
          text[0]
        )}
        {reason ? (
          <span className="mt-2 block text-xs text-ink-500">Alasan: {reason}</span>
        ) : null}
      </>
    );
  }

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
            title="Jawaban menunggu nilai"
            description="Nilai akhir percobaan dihitung ulang setelah seluruh jawaban manualnya dinilai."
          />
          <Card>
            <ul className="divide-y divide-ink-100">
              {essays.map(({ answer, attempt, question, parent, number }) => (
                <li key={answer.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">
                        {attempt.enrollment.participant.name}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {attempt.assessment.batch.title} ·{" "}
                        {attempt.assessment.title} ·{" "}
                        <Link
                          href={`${admin ? "/admin" : "/trainer"}/training/${attempt.assessment.batch.id}/assessments/attempt/${attempt.id}`}
                          className="hover:text-brand-600 hover:underline"
                        >
                          percobaan #{attempt.attemptNumber}
                        </Link>{" "}
                        ·{" "}
                        {attempt.submittedAt
                          ? dateTime(attempt.submittedAt)
                          : "—"}
                      </p>
                      {parent ? (
                        <details className="mt-2 text-xs text-ink-600">
                          <summary className="cursor-pointer">Teks studi kasus</summary>
                          <p className="mt-1 whitespace-pre-line">{parent.text}</p>
                        </details>
                      ) : null}
                      <p className="mt-2 text-sm leading-relaxed text-ink-800">
                        <span className="font-semibold">Soal {number}.</span>{" "}
                        {question.text}
                      </p>
                      <blockquote className="mt-2 border-l-2 border-ink-300 pl-3 text-sm leading-relaxed whitespace-pre-line text-ink-600">
                        <FormatAnswer answer={answer.answer} question={question} />
                      </blockquote>
                    </div>
                    <DialogForm
                      action={reviewAnswerAction.bind(null, answer.id)}
                      title="Nilai jawaban manual"
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
