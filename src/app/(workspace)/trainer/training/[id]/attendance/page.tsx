import { ManageAttendance } from "@/features/training/manage/attendance";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageAttendance id={id} />;
}
