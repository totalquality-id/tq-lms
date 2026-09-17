import { ManageAssignments } from "@/features/training/manage/assignments";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageAssignments id={id} />;
}
