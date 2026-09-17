import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import type { trainingInclude } from "@/repositories/training";
import { dateRange, labels } from "@/lib/utils";

export type TrainingRow = Prisma.TrainingBatchGetPayload<{
  include: typeof trainingInclude;
}>;

export function TrainingTable({
  items,
  base = "/admin/training",
  empty = "Belum ada training",
  emptyDescription = "Training yang dijadwalkan akan muncul di sini.",
  showOrganization = true,
}: {
  items: TrainingRow[];
  base?: string;
  empty?: string;
  emptyDescription?: string;
  showOrganization?: boolean;
}) {
  if (!items.length)
    return <EmptyState title={empty} description={emptyDescription} />;

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Training</Th>
            {showOrganization ? <Th>Organisasi</Th> : null}
            <Th>Jadwal</Th>
            <Th>Trainer</Th>
            <Th className="text-right">Peserta</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-ink-50">
              <Td>
                <Link
                  href={`${base}/${item.id}`}
                  className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="text-xs text-ink-500">
                  {item.code} · {labels[item.mode] ?? item.mode}
                </p>
              </Td>
              {showOrganization ? (
                <Td className="text-sm">
                  {item.organization?.name ?? "Training umum"}
                </Td>
              ) : null}
              <Td className="whitespace-nowrap text-sm">
                {dateRange(item.startDate, item.endDate)}
              </Td>
              <Td className="text-sm">
                {item.trainers.map((link) => link.trainer.name).join(", ") || (
                  <span className="text-ink-400">Belum ditugaskan</span>
                )}
              </Td>
              <Td className="tabular text-right text-sm whitespace-nowrap">
                {item._count.enrollments}
                <span className="text-ink-400"> / {item.capacity}</span>
              </Td>
              <Td>
                <StatusBadge value={item.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}
