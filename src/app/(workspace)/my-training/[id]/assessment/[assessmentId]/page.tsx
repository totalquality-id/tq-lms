import Link from "@/components/ui/navigation-link";

import { Breadcrumb } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { StartAttempt } from "@/features/learning/start-attempt";
import { dateTime, labels, minutes } from "@/lib/utils";
import { attemptWindow } from "@/services/assessment";
import { assessmentForParticipant } from "@/services/assessment";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const { id, assessmentId } = await params;
  const { enrollment, assessment, attempts } = await assessmentForParticipant(
    id,
    assessmentId,
  );

  const submitted = attempts.filter((attempt) => attempt.submittedAt);
  const running = attempts.find(
    (attempt) => !attempt.submittedAt && attempt.expiresAt > new Date(),
  );
  const window = attemptWindow(assessment);
  const remaining = assessment.maxAttempts - attempts.length;
  const closed = enrollment.batch.status === "COMPLETED";

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { href: `/my-training/${id}/assessment`, label: "Penilaian" },
          { label: assessment.title },
        ]}
      />

      <Card>
        <CardHeader
          title={assessment.title}
          description={`${labels[assessment.type] ?? assessment.type} · ${minutes(assessment.durationMinutes)} · nilai kelulusan ${assessment.passingGrade}`}
        />
        <CardBody className="space-y-4">
          {assessment.instructions ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink-700">
              {assessment.instructions}
            </p>
          ) : null}

          <ul className="space-y-1 text-sm text-ink-600">
            <li>
              Waktu pengerjaan {minutes(assessment.durationMinutes)}, dihitung
              sejak percobaan dimulai dan diperiksa di server.
            </li>
            <li>
              Percobaan tersisa: {Math.max(0, remaining)} dari{" "}
              {assessment.maxAttempts}.
            </li>
            {assessment.startsAt ? (
              <li>Dibuka {dateTime(assessment.startsAt)}.</li>
            ) : null}
            {assessment.endsAt ? (
              <li>Ditutup {dateTime(assessment.endsAt)}.</li>
            ) : null}
          </ul>

          {closed ? (
            <Note>
              Training sudah ditutup, penilaian tidak dapat dikerjakan.
            </Note>
          ) : !window.ok ? (
            <Note>{window.reason}</Note>
          ) : running ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link
                  href={`/my-training/${id}/assessment/${assessmentId}/${running.id}`}
                >
                  Lanjutkan percobaan
                </Link>
              </Button>
              <span className="text-xs text-ink-500">
                Berakhir {dateTime(running.expiresAt)}
              </span>
            </div>
          ) : remaining > 0 ? (
            <StartAttempt
              batchId={id}
              assessmentId={assessmentId}
              label={
                submitted.length ? "Mulai percobaan baru" : "Mulai sekarang"
              }
            />
          ) : (
            <Note>Batas percobaan untuk penilaian ini sudah tercapai.</Note>
          )}
        </CardBody>
      </Card>

      {submitted.length ? (
        <Card>
          <CardHeader title="Riwayat percobaan" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Percobaan</Th>
                  <Th>Dikirim</Th>
                  <Th className="text-right">Nilai</Th>
                  <Th>Hasil</Th>
                </tr>
              </thead>
              <tbody>
                {submitted.map((attempt) => (
                  <tr key={attempt.id}>
                    <Td className="tabular">#{attempt.attemptNumber}</Td>
                    <Td className="text-sm">
                      {attempt.submittedAt
                        ? dateTime(attempt.submittedAt)
                        : "—"}
                    </Td>
                    <Td className="tabular text-right">
                      {attempt.score === null
                        ? "—"
                        : assessment.showResult
                          ? Math.round(attempt.score)
                          : "Tersimpan"}
                    </Td>
                    <Td>
                      {attempt.score === null ? (
                        <StatusBadge value="PENDING" />
                      ) : assessment.showResult ? (
                        <StatusBadge
                          value={attempt.passed ? "PASSED" : "FAILED"}
                        />
                      ) : (
                        <span className="text-xs text-ink-500">
                          Diumumkan trainer
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {submitted.some((attempt) => attempt.score === null) ? (
            <CardBody className="border-t border-ink-200">
              <p className="text-xs text-ink-500">
                Terdapat jawaban esai yang menunggu penilaian trainer. Nilai
                akhir muncul setelah pemeriksaan selesai.
              </p>
            </CardBody>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
