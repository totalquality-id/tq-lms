import Link from "@/components/ui/navigation-link";
import { Check, X } from "lucide-react";

import { reviewAnswerAction } from "@/app/staff-actions";
import { Breadcrumb } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DialogForm } from "@/features/management/dialog-form";
import {
  answerParts,
  isAnswerable,
  isManual,
  questionNumbers,
  type SnapshotQuestion,
} from "@/lib/grading";
import { dateTime, labels } from "@/lib/utils";
import { attemptForStaff } from "@/services/assessment";

const formatScore = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/**
 * Satu percobaan peserta sebagaimana dikerjakan: soal dari snapshot, jawaban,
 * kunci, dan nilai per soal. Dari sini trainer menilai esai dan mengoreksi
 * nilai otomatis; nilai percobaan dihitung ulang setiap kali.
 */
export async function AttemptReview({
  base,
  batchId,
  attemptId,
}: {
  base: string;
  batchId: string;
  attemptId: string;
}) {
  const { attempt, snapshot, others } = await attemptForStaff(
    batchId,
    attemptId,
  );
  const numbers = questionNumbers(snapshot);
  const answers = new Map(attempt.answers.map((row) => [row.questionId, row]));
  const root = `${base}/${batchId}/assessments`;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { href: root, label: "Penilaian" },
          { label: `${attempt.assessment.title} · ${attempt.enrollment.participant.name}` },
        ]}
      />

      <Card>
        <CardHeader
          title={attempt.enrollment.participant.name}
          description={`${attempt.assessment.title} · percobaan #${attempt.attemptNumber} · dikirim ${attempt.submittedAt ? dateTime(attempt.submittedAt) : "—"}`}
          action={
            attempt.score === null ? (
              <Badge tone="warning">Menunggu penilaian</Badge>
            ) : (
              <Badge tone={attempt.passed ? "success" : "danger"}>
                Nilai {Math.round(attempt.score)} ·{" "}
                {attempt.passed ? "lulus" : "belum lulus"} (minimum{" "}
                {attempt.assessment.passingGrade})
              </Badge>
            )
          }
        />
        {others.length > 1 ? (
          <CardBody className="flex flex-wrap items-center gap-2 border-t border-ink-200 text-sm">
            <span className="text-xs text-ink-500">Percobaan lain:</span>
            {others.map((other) =>
              other.id === attempt.id ? (
                <span key={other.id} className="font-semibold text-ink-900">
                  #{other.attemptNumber}
                </span>
              ) : (
                <Link
                  key={other.id}
                  href={`${root}/attempt/${other.id}`}
                  className="text-brand-700 hover:underline"
                >
                  #{other.attemptNumber}
                  {other.score !== null ? ` (${Math.round(other.score)})` : ""}
                </Link>
              ),
            )}
          </CardBody>
        ) : null}
      </Card>

      {snapshot.map((question) => {
        const label = numbers.get(question.id) ?? "";
        const child = label.includes(".");
        if (!isAnswerable(question))
          return (
            <Card key={question.id}>
              <CardHeader title={`Studi kasus ${label}`} />
              <CardBody>
                <p className="text-sm leading-relaxed whitespace-pre-line text-ink-800">
                  {question.text}
                </p>
              </CardBody>
            </Card>
          );

        const row = answers.get(question.id);
        const { answer, reason } = answerParts(row?.answer);
        return (
          <Card
            key={question.id}
            className={child ? "ml-4 border-l-4 border-l-brand-200 sm:ml-8" : undefined}
          >
            <CardHeader
              title={`Soal ${label}`}
              description={`${labels[question.type] ?? question.type} · ${question.points} poin`}
              action={
                !row ? (
                  <Badge>Tidak dijawab · 0</Badge>
                ) : row.score === null ? (
                  <Badge tone="warning">Belum dinilai</Badge>
                ) : (
                  <Badge
                    tone={
                      row.score >= question.points
                        ? "success"
                        : row.score > 0
                          ? "warning"
                          : "danger"
                    }
                  >
                    {formatScore(row.score)} / {question.points}
                  </Badge>
                )
              }
            />
            <CardBody className="space-y-3">
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-800">
                {question.text}
              </p>
              <AnswerView question={question} answer={row ? answer : undefined} />
              {reason ? (
                <div className="rounded-md bg-ink-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-ink-500">
                    Alasan peserta
                  </p>
                  <p className="mt-1 whitespace-pre-line text-ink-800">{reason}</p>
                </div>
              ) : null}
              {row?.feedback ? (
                <p className="text-xs text-ink-600">
                  <span className="font-semibold">Umpan balik:</span>{" "}
                  {row.feedback}
                </p>
              ) : null}
              {row ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3">
                  <span className="text-xs text-ink-500">
                    {row.reviewedAt
                      ? `Dinilai trainer ${dateTime(row.reviewedAt)}`
                      : isManual(question)
                        ? "Menunggu penilaian trainer"
                        : "Dinilai otomatis"}
                  </span>
                  <DialogForm
                    action={reviewAnswerAction.bind(null, row.id)}
                    title={row.score === null ? "Nilai jawaban" : "Koreksi nilai"}
                    description={`Soal ${label} · bobot ${question.points} poin. Nilai percobaan dihitung ulang setelah disimpan.`}
                    fields={[
                      {
                        name: "score",
                        label: `Nilai (0–${question.points})`,
                        type: "number",
                        required: true,
                        min: 0,
                        max: question.points,
                        defaultValue: row.score ?? undefined,
                      },
                      {
                        name: "feedback",
                        label: "Umpan balik",
                        type: "textarea",
                        full: true,
                        defaultValue: row.feedback ?? "",
                      },
                    ]}
                    trigger={row.score === null ? "Nilai" : "Koreksi nilai"}
                    triggerVariant="secondary"
                    triggerSize="sm"
                    submitLabel="Simpan nilai"
                  />
                </div>
              ) : null}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function AnswerView({
  question,
  answer,
}: {
  question: SnapshotQuestion;
  answer: unknown;
}) {
  if (question.options.length) {
    const chosen = new Set(
      (Array.isArray(answer) ? answer : [answer]).filter(
        (value): value is string => typeof value === "string",
      ),
    );
    return (
      <ul className="space-y-1.5">
        {question.options.map((option) => {
          const picked = chosen.has(option.id);
          return (
            <li
              key={option.id}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${option.correct ? "border-brand-200 bg-brand-50" : "border-ink-200"}`}
            >
              <span className="mt-0.5 w-4 shrink-0" aria-hidden>
                {picked ? (
                  option.correct ? (
                    <Check className="size-4 text-[var(--color-success)]" />
                  ) : (
                    <X className="size-4 text-[var(--color-danger)]" />
                  )
                ) : null}
              </span>
              <span className="min-w-0 flex-1 text-ink-800">{option.text}</span>
              <span className="shrink-0 text-xs text-ink-500">
                {[picked ? "dipilih" : null, option.correct ? "kunci" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <blockquote className="border-l-2 border-ink-300 pl-3 whitespace-pre-line text-ink-700">
        {typeof answer === "string" && answer.trim() ? (
          answer
        ) : (
          <span className="text-ink-400">Tidak dijawab</span>
        )}
      </blockquote>
      {question.type === "SHORT_TEXT" && question.correctText ? (
        <p className="text-xs text-ink-500">
          Kunci yang diterima:{" "}
          {question.correctText
            .split("|")
            .map((value) => value.trim())
            .join(" / ")}
        </p>
      ) : null}
    </div>
  );
}
