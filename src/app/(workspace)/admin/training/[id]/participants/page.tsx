import { ManageParticipants } from "@/features/training/manage/participants";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageParticipants id={id} />;
}
