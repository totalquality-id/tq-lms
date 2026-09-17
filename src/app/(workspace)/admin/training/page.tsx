import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, Pagination, PAGE_SIZE } from "@/components/ui/pagination";
import { CreateTraining } from "@/features/training/create-training";
import { TrainingTable } from "@/features/training/training-table";
import { listTraining } from "@/repositories/training";
import { currentUser } from "@/services/access";

export const metadata: Metadata = { title: "Training" };

export default async function TrainingListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const page = getPage(filters.page);
  const user = await currentUser();
  const { items, total } = await listTraining(
    user,
    filters.q,
    filters.status,
    page,
    PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader
        title="Training"
        description="Jadwal kelas, penugasan trainer, dan pendaftaran peserta."
        action={<CreateTraining />}
      />
      <Card>
        <FilterBar
          q={filters.q}
          placeholder="Cari nama, kode, atau organisasi…"
          filters={[
            {
              name: "status",
              value: filters.status,
              label: "Filter status",
              anyLabel: "Semua status",
              options: ["DRAFT", "OPEN", "ONGOING", "COMPLETED", "CANCELLED"],
            },
          ]}
        />
        <TrainingTable items={items} />
        <Pagination
          total={total}
          page={page}
          params={{ q: filters.q, status: filters.status }}
        />
      </Card>
    </div>
  );
}
