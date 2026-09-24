import type { Metadata } from "next";
import Link from "@/components/ui/navigation-link";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateRange } from "@/lib/utils";
import { requireAdmin } from "@/services/access";

export const metadata: Metadata = { title: "Evaluasi" };

/**
 * Rekap lintas training. Angka yang ditampilkan hanya rata-rata dan tingkat
 * pengisian; komentar tertulis tetap berada di halaman training masing-masing
 * agar dibaca bersama konteksnya.
 */
export default async function EvaluationsPage() {
  await requireAdmin();

  const evaluations = await db.trainingEvaluation.findMany({
    where: { batch: { deletedAt: null } },
    include: {
      responses: true,
      batch: {
        include: {
          organization: true,
          _count: {
            select: {
              enrollments: {
                where: { deletedAt: null, status: { not: "CANCELLED" } },
              },
            },
          },
        },
      },
    },
    orderBy: { batch: { startDate: "desc" } },
    take: 100,
  });

  if (!evaluations.length)
    return (
      <div>
        <PageHeader
          title="Evaluasi pelatihan"
          description="Rekap masukan peserta dari seluruh training."
        />
        <Card>
          <EmptyState
            title="Belum ada evaluasi"
            description="Evaluasi dibuka dari halaman training menjelang kelas berakhir."
          />
        </Card>
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Evaluasi pelatihan"
        description="Rekap masukan peserta dari seluruh training."
      />
      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Training</Th>
                <Th>Organisasi</Th>
                <Th>Jadwal</Th>
                <Th className="text-right">Pengisian</Th>
                <Th className="text-right">Rata-rata</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation) => {
                const rows = evaluation.responses.map(
                  (response) =>
                    response.answers as Record<string, string | number>,
                );
                const values = rows.flatMap((row) =>
                  Object.values(row)
                    .map((value) => Number(value))
                    .filter(
                      (value) =>
                        Number.isFinite(value) && value >= 1 && value <= 5,
                    ),
                );
                const average = values.length
                  ? values.reduce((sum, value) => sum + value, 0) /
                    values.length
                  : 0;
                const enrolled = evaluation.batch._count.enrollments;

                return (
                  <tr key={evaluation.id} className="hover:bg-ink-50">
                    <Td>
                      <Link
                        href={`/admin/training/${evaluation.batchId}/evaluation`}
                        className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
                      >
                        {evaluation.batch.title}
                      </Link>
                    </Td>
                    <Td className="text-sm">
                      {evaluation.batch.organization?.name ?? "Training umum"}
                    </Td>
                    <Td className="text-sm whitespace-nowrap">
                      {dateRange(
                        evaluation.batch.startDate,
                        evaluation.batch.endDate,
                      )}
                    </Td>
                    <Td className="tabular text-right text-sm whitespace-nowrap">
                      {evaluation.responses.length}
                      <span className="text-ink-400"> / {enrolled}</span>
                    </Td>
                    <Td className="tabular text-right text-sm font-medium">
                      {average ? average.toFixed(2) : "—"}
                    </Td>
                    <Td className="text-sm">
                      {evaluation.open ? "Terbuka" : "Ditutup"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </div>
  );
}
