import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { AssignmentForm } from "@/features/learning/assignment-form";
import { dateTime } from "@/lib/utils";
import { myEnrollment } from "@/services/learning";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;
  const enrollment = await myEnrollment(id);

  const assignment = enrollment.batch.assignments.find(
    (item) => item.id === assignmentId,
  );
  if (!assignment) notFound();

  const submission = enrollment.submissions.find(
    (item) => item.assignmentId === assignmentId,
  );
  const closed =
    enrollment.batch.status === "COMPLETED" ||
    submission?.status === "COMPLETED";

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { href: `/my-training/${id}/assignment`, label: "Tugas" },
          { label: assignment.title },
        ]}
      />

      <Card>
        <CardHeader
          title={assignment.title}
          description={`Batas waktu ${dateTime(assignment.dueAt)} · nilai maksimum ${assignment.maxScore}`}
          action={<StatusBadge value={submission?.status ?? "NOT_SUBMITTED"} />}
        />
        <CardBody>
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink-700">
            {assignment.instructions}
          </p>
        </CardBody>
      </Card>

      {submission ? (
        <Card>
          <CardHeader title="Pengumpulan Anda" />
          <CardBody className="space-y-3 text-sm">
            <p>
              <span className="text-ink-500">Tautan: </span>
              <a
                href={submission.link}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-600 hover:underline"
              >
                {submission.link}
              </a>
            </p>
            {submission.notes ? (
              <p className="whitespace-pre-line text-ink-700">
                <span className="text-ink-500">Catatan: </span>
                {submission.notes}
              </p>
            ) : null}
            <p className="text-xs text-ink-500">
              Dikumpulkan {dateTime(submission.submittedAt)}
            </p>
            {submission.score !== null ? (
              <p className="tabular text-sm font-medium text-ink-900">
                Nilai {Math.round(submission.score)} dari {assignment.maxScore}
              </p>
            ) : null}
            {submission.feedback ? (
              <Note>
                <span className="font-medium text-ink-800">
                  Umpan balik trainer:{" "}
                </span>
                {submission.feedback}
              </Note>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {closed ? (
        <Note>
          {submission?.status === "COMPLETED"
            ? "Tugas ini sudah dinyatakan selesai oleh trainer."
            : "Training sudah ditutup, pengumpulan tidak dapat diperbarui."}
        </Note>
      ) : (
        <Card>
          <CardHeader
            title={submission ? "Perbarui pengumpulan" : "Kumpulkan tugas"}
          />
          <CardBody>
            <AssignmentForm
              batchId={id}
              assignmentId={assignmentId}
              link={submission?.link ?? ""}
              notes={submission?.notes ?? ""}
              submitted={Boolean(submission)}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
