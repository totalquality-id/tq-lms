import { ParticipantDashboard } from "@/features/training/participant-pages";
import { requireRole } from "@/services/access";

export default async function Page() {
  await requireRole("PARTICIPANT");
  return <ParticipantDashboard />;
}
