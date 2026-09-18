import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { dateTime } from "@/lib/utils";
import { myEnrollment } from "@/services/learning";

export default async function AssignmentListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enrollment = await myEnrollment(id);
  const { assignments } = enrollment.batch;

  if (!assignments.length)
    return (
      <Card>
        <EmptyState
          title="Belum ada tugas"
          description="Tugas yang diberikan trainer akan muncul di sini."
        />
      </Card>
    );

  return (
    <Card>
      <ul className="divide-y divide-ink-100">
        {assignments.map((assignment) => {
          const submission = enrollment.submissions.find(
            (item) => item.assignmentId === assignment.id,
          );
          const overdue =
            !submission && assignment.dueAt.getTime() < Date.now();

          return (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/my-training/${id}/assignment/${assignment.id}`}
                  className="text-sm font-medium text-ink-900 hover:text-brand-700 hover:underline"
                >
                  {assignment.title}
                </Link>
                <p className="mt-0.5 text-xs text-ink-500">
                  Batas waktu {dateTime(assignment.dueAt)}
                  {assignment.required ? "" : " · opsional"}
                  {overdue ? " · lewat batas waktu" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {submission?.score !== null &&
                submission?.score !== undefined ? (
                  <span className="tabular text-sm font-medium text-ink-900">
                    {Math.round(submission.score)}/{assignment.maxScore}
                  </span>
                ) : null}
                <StatusBadge value={submission?.status ?? "NOT_SUBMITTED"} />
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/my-training/${id}/assignment/${assignment.id}`}>
                    {submission ? "Lihat" : "Kumpulkan"}
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
