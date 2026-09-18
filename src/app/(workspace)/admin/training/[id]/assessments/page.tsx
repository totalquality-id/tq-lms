import { getPage } from "@/components/ui/pagination";
import { ManageAssessments } from "@/features/training/manage/assessments";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const [{ id }, filters] = await Promise.all([params, searchParams]);
  return (
    <ManageAssessments
      id={id}
      page={getPage(filters.page)}
      q={filters.q?.trim() || undefined}
    />
  );
}
