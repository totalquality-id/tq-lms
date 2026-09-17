import { ManageCertificates } from "@/features/training/manage/certificates";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManageCertificates id={id} />;
}
