import { archiveAssessmentAction, assessmentAction } from "@/app/staff-actions";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { assessmentFields } from "@/features/management/staff-fields";
import { db } from "@/lib/db";
import { dateTime, labels, minutes } from "@/lib/utils";
import { accessibleBatch } from "@/services/access";
import { bestScore } from "@/services/assessment";

export async function ManageAssessments({ id }: { id: string }) {
  const { batch } = await accessibleBatch(id);

  const bankSize = await db.question.count({
    where: { courseId: batch.courseId, deletedAt: null },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Penilaian"
          description="Pre-test, kuis, dan ujian akhir untuk kelas ini."
          action={
            <DialogForm
              action={assessmentAction.bind(null, id, undefined)}
              title="Buat penilaian"
              description="Soal diambil dari bank soal course. Atur daftar soalnya setelah penilaian tersimpan."
              fields={assessmentFields()}
              triggerSize="sm"
            />
          }
        />
        {batch.assessments.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Penilaian</Th>
                  <Th>Jenis</Th>
                  <Th>Jendela waktu</Th>
                  <Th className="text-right">Dikerjakan</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Tindakan</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {batch.assessments.map((assessment) => {
                  const attempts = batch.enrollments.flatMap((enrollment) =>
                    enrollment.attempts.filter(
                      (attempt) =>
                        attempt.assessmentId === assessment.id &&
                        attempt.submittedAt,
                    ),
                  );
                  return (
                    <tr key={assessment.id}>
                      <Td>
                        <p className="font-medium whitespace-nowrap text-ink-900">
                          {assessment.title}
                        </p>
                        <p className="text-xs whitespace-nowrap text-ink-500">
                          {minutes(assessment.durationMinutes)} · lulus{" "}
                          {assessment.passingGrade} · maks{" "}
                          {assessment.maxAttempts}×
                        </p>
                      </Td>
                      <Td>
                        <Badge tone="neutral">
                          {labels[assessment.type] ?? assessment.type}
                        </Badge>
                      </Td>
                      <Td className="text-xs whitespace-nowrap">
                        {assessment.startsAt || assessment.endsAt ? (
                          <>
                            {assessment.startsAt
                              ? dateTime(assessment.startsAt)
                              : "Kapan saja"}
                            <span className="block text-ink-500">
                              s.d.{" "}
                              {assessment.endsAt
                                ? dateTime(assessment.endsAt)
                                : "tanpa batas"}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-400">Tanpa jendela</span>
                        )}
                      </Td>
                      <Td className="tabular text-right text-sm">
                        {
                          new Set(
                            attempts.map((attempt) => attempt.enrollmentId),
                          ).size
                        }
                        <span className="text-ink-400">
                          {" "}
                          / {batch.enrollments.length}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge
                          value={assessment.published ? "PUBLISHED" : "DRAFT"}
                        />
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <DialogForm
                            action={assessmentAction.bind(
                              null,
                              id,
                              assessment.id,
                            )}
                            title="Edit penilaian"
                            fields={assessmentFields(assessment)}
                            trigger="Edit"
                            triggerVariant="secondary"
                            triggerSize="sm"
                          />
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            action={archiveAssessmentAction.bind(
                              null,
                              id,
                              assessment.id,
                            )}
                            confirm={{
                              title: "Arsipkan penilaian?",
                              description:
                                "Penilaian disembunyikan dari peserta. Percobaan dan nilai yang sudah tercatat tetap tersimpan.",
                            }}
                            confirmLabel="Arsipkan"
                          >
                            Arsipkan
                          </ActionButton>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Belum ada penilaian"
            description="Buat pre-test atau ujian akhir untuk mengukur pemahaman peserta."
          />
        )}
        <CardBody className="border-t border-ink-200">
          {bankSize ? (
            <p className="text-xs text-ink-500">
              Bank soal course ini berisi {bankSize} soal. Penilaian mengambil
              soal dari bank tersebut saat percobaan dimulai.
            </p>
          ) : (
            <Note>
              Bank soal untuk course ini masih kosong. Tambahkan soal di menu
              Bank soal sebelum menerbitkan penilaian — percobaan tidak dapat
              dimulai tanpa soal.
            </Note>
          )}
        </CardBody>
      </Card>

      {batch.assessments.length && batch.enrollments.length ? (
        <Card>
          <CardHeader
            title="Nilai peserta"
            description="Nilai terbaik setiap peserta pada tiap penilaian."
          />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Peserta</Th>
                  {batch.assessments.map((assessment) => (
                    <Th key={assessment.id} className="text-right">
                      {assessment.title}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <Td className="text-sm whitespace-nowrap">
                      {enrollment.participant.name}
                    </Td>
                    {batch.assessments.map((assessment) => {
                      const attempts = enrollment.attempts.filter(
                        (attempt) => attempt.assessmentId === assessment.id,
                      );
                      const submitted = attempts.filter(
                        (attempt) => attempt.submittedAt,
                      );
                      const score = bestScore(attempts);
                      return (
                        <Td
                          key={assessment.id}
                          className="tabular text-right text-sm"
                        >
                          {score !== null ? (
                            Math.round(score)
                          ) : submitted.length ? (
                            <span className="text-xs text-[var(--color-warning)]">
                              Perlu dinilai
                            </span>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}
    </div>
  );
}
