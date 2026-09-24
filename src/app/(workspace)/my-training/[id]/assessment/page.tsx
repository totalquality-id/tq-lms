import Link from "@/components/ui/navigation-link";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { bestScore } from "@/services/assessment";
import { myEnrollment } from "@/services/learning";
import { dateTime, labels, minutes } from "@/lib/utils";

export default async function AssessmentListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enrollment = await myEnrollment(id);
  const { assessments } = enrollment.batch;

  if (!assessments.length)
    return (
      <Card>
        <EmptyState
          title="Belum ada penilaian"
          description="Pre-test, kuis, dan ujian akhir akan muncul di sini setelah trainer membukanya."
        />
      </Card>
    );

  return (
    <Card>
      <ul className="divide-y divide-ink-100">
        {assessments.map((assessment) => {
          const attempts = enrollment.attempts.filter(
            (attempt) => attempt.assessmentId === assessment.id,
          );
          const submitted = attempts.filter((attempt) => attempt.submittedAt);
          const score = bestScore(attempts);
          const pending = submitted.some((attempt) => attempt.score === null);

          return (
            <li
              key={assessment.id}
              className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/my-training/${id}/assessment/${assessment.id}`}
                    className="text-sm font-medium text-ink-900 hover:text-brand-700 hover:underline"
                  >
                    {assessment.title}
                  </Link>
                  <Badge tone="neutral">
                    {labels[assessment.type] ?? assessment.type}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">
                  {minutes(assessment.durationMinutes)} · nilai kelulusan{" "}
                  {assessment.passingGrade} · maksimal {assessment.maxAttempts}{" "}
                  percobaan
                  {assessment.endsAt
                    ? ` · ditutup ${dateTime(assessment.endsAt)}`
                    : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {pending ? (
                  <StatusBadge value="PENDING" />
                ) : score !== null ? (
                  <span className="tabular text-sm font-medium text-ink-900">
                    {Math.round(score)}
                  </span>
                ) : (
                  <span className="text-xs text-ink-400">Belum dikerjakan</span>
                )}
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/my-training/${id}/assessment/${assessment.id}`}>
                    {submitted.length ? "Lihat hasil" : "Mulai"}
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
