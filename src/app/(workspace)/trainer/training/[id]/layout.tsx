import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ManageTabs } from "@/features/training/manage/tabs";
import { dateRange } from "@/lib/utils";
import { batchLayout } from "@/services/batch";

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { batch } = await batchLayout(id);

  return (
    <>
      <PageHeader
        backHref="/trainer/training"
        backLabel="Training"
        title={batch.title}
        meta={<StatusBadge value={batch.status} />}
        description={`${batch.code} · ${batch.organization?.name ?? "Training umum"} · ${dateRange(batch.startDate, batch.endDate)}`}
      />
      <ManageTabs
        base="/trainer/training"
        id={id}
        counts={{
          participants: batch._count.enrollments,
          assessments: batch._count.assessments,
          assignments: batch._count.assignments,
          resources: batch._count.resources,
        }}
      />
      {children}
    </>
  );
}
