import { archiveAssessmentAction, assessmentAction } from "@/app/staff-actions";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { Note } from "@/components/ui/field";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { assessmentFields } from "@/features/management/staff-fields";
import { db } from "@/lib/db";
import { parseRules } from "@/lib/question-selection";
import { dateTime, labels, minutes } from "@/lib/utils";
import { ROWS_PER_PAGE, batchAssessments } from "@/services/batch";
import { bestScore } from "@/services/assessment";
import { courseQuestions, courseTopics } from "@/services/question-bank";
import { ManualQuestionPicker, SelectionRulesForm } from "./question-selection";

export async function ManageAssessments({
  id,
  page,
  q,
}: {
  id: string;
  page: number;
  q?: string;
}) {
  const { batch, attempted, participants } = await batchAssessments(id, {
    page,
    q,
  });

  // Bank soal dibaca sekali dan dipakai bersama oleh pemilihan manual,
  // aturan per topik, dan ringkasan di bawah tabel.
  const [bank, topics, chosen] = await Promise.all([
    courseQuestions(id),
    courseTopics(id),
    db.assessmentQuestion.findMany({
      where: { assessment: { batchId: id } },
      orderBy: { position: "asc" },
      select: { assessmentId: true, questionId: true },
    }),
  ]);
  const bankSize = bank.length;
  const manualByAssessment = new Map<string, string[]>();
  for (const link of chosen) {
    const list = manualByAssessment.get(link.assessmentId);
    if (list) list.push(link.questionId);
    else manualByAssessment.set(link.assessmentId, [link.questionId]);
  }

  const SOURCE_LABEL: Record<string, string> = {
    ALL: "Seluruh bank soal",
    MANUAL: "Dipilih trainer",
    RULES: "Per topik",
  };

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
                  <Th>Sumber soal</Th>
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
                      <Td>
                        <p className="text-xs whitespace-nowrap text-ink-700">
                          {SOURCE_LABEL[assessment.selection] ??
                            assessment.selection}
                        </p>
                        <p className="tabular text-xs whitespace-nowrap text-ink-500">
                          {assessment.selection === "MANUAL"
                            ? `${(manualByAssessment.get(assessment.id) ?? []).length} soal`
                            : assessment.selection === "RULES"
                              ? `${parseRules(assessment.selectionRules).reduce(
                                  (sum, rule) => sum + rule.count,
                                  0,
                                )} soal`
                              : assessment.questionLimit
                                ? `${assessment.questionLimit} dari ${bankSize}`
                                : `${bankSize} soal`}
                        </p>
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
                        {attempted.get(assessment.id) ?? 0}
                        <span className="text-ink-400"> / {participants}</span>
                      </Td>
                      <Td>
                        <StatusBadge
                          value={assessment.published ? "PUBLISHED" : "DRAFT"}
                        />
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          {assessment.selection === "MANUAL" ? (
                            <ManualQuestionPicker
                              batchId={id}
                              assessmentId={assessment.id}
                              title={assessment.title}
                              bank={bank}
                              selected={
                                manualByAssessment.get(assessment.id) ?? []
                              }
                            />
                          ) : assessment.selection === "RULES" ? (
                            <SelectionRulesForm
                              batchId={id}
                              assessmentId={assessment.id}
                              title={assessment.title}
                              topics={topics}
                              rules={parseRules(assessment.selectionRules)}
                            />
                          ) : null}
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

      {batch.assessments.length && participants ? (
        <Card>
          <CardHeader
            title="Nilai peserta"
            description="Nilai terbaik setiap peserta pada tiap penilaian."
          />
          <FilterBar q={q} placeholder="Cari nama peserta…" />
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
          <Pagination
            total={batch._count.enrollments}
            page={page}
            size={ROWS_PER_PAGE}
            params={{ q }}
          />
        </Card>
      ) : null}
    </div>
  );
}
