import { ManageOverview } from "@/features/training/manage/overview";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageOverview id={id} />;
}
