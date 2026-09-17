import { ManageEvaluation } from "@/features/training/manage/evaluation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageEvaluation id={id} />;
}
