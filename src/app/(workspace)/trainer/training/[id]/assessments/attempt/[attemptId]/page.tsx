import { AttemptReview } from "@/features/training/manage/attempt-review";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  return <AttemptReview base="/trainer/training" batchId={id} attemptId={attemptId} />;
}
