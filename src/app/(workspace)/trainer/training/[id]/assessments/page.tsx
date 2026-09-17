import { ManageAssessments } from "@/features/training/manage/assessments";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageAssessments id={id} />;
}
