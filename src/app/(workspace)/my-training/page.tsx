import type { Metadata } from "next";

import { ParticipantTrainingList } from "@/features/training/participant-pages";
import { requireRole } from "@/services/access";

export const metadata: Metadata = { title: "Training saya" };

export default async function Page() {
  await requireRole("PARTICIPANT");
  return <ParticipantTrainingList />;
}
