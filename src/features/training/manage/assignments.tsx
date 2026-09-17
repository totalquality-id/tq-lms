import {
  archiveAssignmentAction,
  assignmentAction,
  reviewSubmissionAction,
} from "@/app/staff-actions";
import { ActionButton } from "@/components/ui/action-button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import {
  assignmentFields,
  reviewFields,
} from "@/features/management/staff-fields";
import { dateTime } from "@/lib/utils";
import { accessibleBatch } from "@/services/access";

export async function ManageAssignments({ id }: { id: string }) {
  const { batch } = await accessibleBatch(id);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Tugas"
          description="Tugas praktik yang dikumpulkan peserta dan dinilai trainer."
          action={
            <DialogForm
              action={assignmentAction.bind(null, id, undefined)}
              title="Buat tugas"
              fields={assignmentFields()}
              triggerSize="sm"
            />
          }
        />
        {batch.assignments.length ? (
          <ul className="divide-y divide-ink-100">
            {batch.assignments.map((assignment) => {
              const submissions = batch.enrollments.flatMap((enrollment) =>
                enrollment.submissions
                  .filter((item) => item.assignmentId === assignment.id)
                  .map((item) => ({
                    submission: item,
                    participant: enrollment.participant,
                  })),
              );
              const waiting = submissions.filter(
                (row) => row.submission.status === "SUBMITTED",
              ).length;

              return (
                <li key={assignment.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        {assignment.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        Batas waktu {dateTime(assignment.dueAt)} · nilai
                        maksimum {assignment.maxScore} ·{" "}
                        {assignment.required ? "wajib" : "opsional"} ·{" "}
                        {assignment.published ? "terbit" : "draft"}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        {submissions.length} dari {batch.enrollments.length}{" "}
                        peserta mengumpulkan
                        {waiting ? ` · ${waiting} menunggu penilaian` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <DialogForm
                        action={assignmentAction.bind(null, id, assignment.id)}
                        title="Edit tugas"
                        fields={assignmentFields(assignment)}
                        trigger="Edit"
                        triggerVariant="secondary"
                        triggerSize="sm"
                      />
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={archiveAssignmentAction.bind(
                          null,
                          id,
                          assignment.id,
                        )}
                        confirm={{
                          title: "Arsipkan tugas?",
                          description:
                            "Tugas disembunyikan dari peserta. Pengumpulan dan nilai yang sudah ada tetap tersimpan.",
                        }}
                        confirmLabel="Arsipkan"
                      >
                        Arsipkan
                      </ActionButton>
                    </div>
                  </div>

                  {submissions.length ? (
                    <TableWrap className="mt-3 rounded-md border border-ink-200">
                      <Table>
                        <thead>
                          <tr>
                            <Th>Peserta</Th>
                            <Th>Berkas</Th>
                            <Th>Dikumpulkan</Th>
                            <Th className="text-right">Nilai</Th>
                            <Th>Status</Th>
                            <Th>
                              <span className="sr-only">Tindakan</span>
                            </Th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map(({ submission, participant }) => (
                            <tr key={submission.id}>
                              <Td className="text-sm whitespace-nowrap">
                                {participant.name}
                              </Td>
                              <Td>
                                <a
                                  href={submission.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs break-all text-brand-600 hover:underline"
                                >
                                  Buka tautan
                                </a>
                              </Td>
                              <Td className="text-xs whitespace-nowrap">
                                {dateTime(submission.submittedAt)}
                              </Td>
                              <Td className="tabular text-right text-sm">
                                {submission.score === null
                                  ? "—"
                                  : Math.round(submission.score)}
                              </Td>
                              <Td>
                                <StatusBadge value={submission.status} />
                              </Td>
                              <Td className="text-right">
                                <DialogForm
                                  action={reviewSubmissionAction.bind(
                                    null,
                                    id,
                                    submission.id,
                                  )}
                                  title="Nilai tugas"
                                  description={`${participant.name} — ${assignment.title}`}
                                  fields={reviewFields(
                                    assignment.maxScore,
                                    submission,
                                  )}
                                  trigger="Nilai"
                                  triggerVariant="secondary"
                                  triggerSize="sm"
                                  submitLabel="Simpan penilaian"
                                />
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableWrap>
                  ) : (
                    <p className="mt-3 text-xs text-ink-400">
                      Belum ada pengumpulan.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Belum ada tugas"
            description="Buat tugas praktik agar peserta menerapkan materi pada pekerjaannya."
          />
        )}
        <CardBody className="border-t border-ink-200">
          <p className="text-xs leading-relaxed text-ink-500">
            Peserta mengumpulkan tugas sebagai tautan berkas. Pastikan Anda
            memiliki akses baca pada tautan tersebut sebelum menilai.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
