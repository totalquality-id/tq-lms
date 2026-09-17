import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { ManageTabs } from "@/features/training/manage/tabs";
import { dateRange } from "@/lib/utils";
import { accessibleBatch } from "@/services/access";

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { batch } = await accessibleBatch(id);

  return (
    <>
      <PageHeader
        backHref="/admin/training"
        backLabel="Training"
        title={batch.title}
        meta={<StatusBadge value={batch.status} />}
        description={`${batch.code} · ${batch.organization?.name ?? "Training umum"} · ${dateRange(batch.startDate, batch.endDate)}`}
      />
      <ManageTabs
        base="/admin/training"
        id={id}
        counts={{
          participants: batch.enrollments.length,
          assessments: batch.assessments.length,
          assignments: batch.assignments.length,
          resources: batch.resources.length,
        }}
      />
      {children}
    </>
  );
}
