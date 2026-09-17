import { TrainerDashboard } from "@/features/training/staff-pages";
import { requireRole } from "@/services/access";

export default async function Page() {
  await requireRole("TRAINER");
  return <TrainerDashboard />;
}
