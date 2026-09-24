import type { Metadata } from "next";
import Link from "@/components/ui/navigation-link";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateRange, daysBetween } from "@/lib/utils";
import { requireRole } from "@/services/access";
import { bestScore } from "@/services/assessment";
import { eligibilityInclude } from "@/services/certificate";
import { attendanceRate } from "@/services/learning";

export const metadata: Metadata = { title: "Riwayat pelatihan" };

/**
 * Rekam kompetensi peserta: satu baris ringkas per pelatihan yang pernah
 * diikuti, lengkap dengan nilai, kehadiran, dan nomor sertifikatnya. Halaman
 * ini bertahan setelah training ditutup — itulah gunanya.
 */
export default async function HistoryPage() {
  const user = await requireRole("PARTICIPANT");

  const enrollments = await db.enrollment.findMany({
    where: {
      participantId: user.id,
      deletedAt: null,
      status: { not: "CANCELLED" },
      batch: { deletedAt: null },
    },
    include: eligibilityInclude,
    orderBy: { batch: { startDate: "desc" } },
  });

  if (!enrollments.length)
    return (
      <div>
        <PageHeader
          title="Riwayat pelatihan"
          description="Catatan pelatihan dan kompetensi Anda."
        />
        <Card>
          <EmptyState
            title="Belum ada riwayat"
            description="Riwayat terbentuk setelah Anda mengikuti pelatihan pertama."
          />
        </Card>
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Riwayat pelatihan"
        description="Catatan pelatihan dan kompetensi Anda, tersimpan permanen."
      />
      <div className="space-y-4">
        {enrollments.map((enrollment) => {
          const { batch } = enrollment;
          const days = daysBetween(batch.startDate, batch.endDate).length;
          const pre = batch.assessments.find(
            (item) => item.type === "PRE_TEST",
          );
          const final = batch.assessments.find(
            (item) => item.type === "FINAL_EXAM",
          );
          const score = (assessmentId?: string) =>
            assessmentId
              ? bestScore(
                  enrollment.attempts.filter(
                    (attempt) => attempt.assessmentId === assessmentId,
                  ),
                )
              : null;
          const preScore = score(pre?.id);
          const finalScore = score(final?.id);
          const requiredAssignments = batch.assignments.filter(
            (assignment) => assignment.required,
          );
          const assignmentsDone = requiredAssignments.filter((assignment) => {
            const submission = enrollment.submissions.find(
              (item) => item.assignmentId === assignment.id,
            );
            return (
              submission &&
              (submission.status === "REVIEWED" ||
                submission.status === "COMPLETED")
            );
          }).length;

          return (
            <Card key={enrollment.id}>
              <CardHeader
                title={
                  <Link
                    href={`/my-training/${batch.id}`}
                    className="hover:text-brand-700 hover:underline"
                  >
                    {batch.course.title}
                  </Link>
                }
                description={`${batch.title} · ${dateRange(batch.startDate, batch.endDate)}`}
                action={<StatusBadge value={enrollment.status} />}
              />
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  <div>
                    <dt className="text-xs text-ink-500">Pre-Test</dt>
                    <dd className="tabular mt-0.5 text-sm text-ink-900">
                      {preScore === null ? "—" : Math.round(preScore)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Ujian akhir</dt>
                    <dd className="tabular mt-0.5 text-sm text-ink-900">
                      {finalScore === null ? "—" : Math.round(finalScore)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Kehadiran</dt>
                    <dd className="tabular mt-0.5 text-sm text-ink-900">
                      {enrollment.attendance.length
                        ? `${attendanceRate(enrollment.attendance, days)}%`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Tugas wajib</dt>
                    <dd className="tabular mt-0.5 text-sm text-ink-900">
                      {requiredAssignments.length
                        ? `${assignmentsDone}/${requiredAssignments.length}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Sertifikat</dt>
                    <dd className="tabular mt-0.5 text-sm text-ink-900">
                      {enrollment.certificate?.status === "ISSUED" ? (
                        <Link
                          href={`/verify/${enrollment.certificate.number}`}
                          className="text-brand-600 hover:underline"
                        >
                          {enrollment.certificate.number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
