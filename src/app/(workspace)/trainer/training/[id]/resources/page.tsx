import { ManageResources } from "@/features/training/manage/resources";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageResources id={id} />;
}
