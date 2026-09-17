import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { TrainingTabs } from "@/features/learning/training-tabs";
import { dateRange } from "@/lib/utils";
import { myEnrollment } from "@/services/learning";

export default async function TrainingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enrollment = await myEnrollment(id);
  const { batch } = enrollment;

  return (
    <>
      <PageHeader
        backHref="/my-training"
        backLabel="Training saya"
        title={batch.title}
        meta={<StatusBadge value={batch.status} />}
        description={`${batch.organization?.name ?? "Training umum"} · ${dateRange(batch.startDate, batch.endDate)}`}
      />
      <TrainingTabs enrollment={enrollment} />
      {children}
    </>
  );
}
