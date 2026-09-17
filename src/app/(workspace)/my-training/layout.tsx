import { requireRole } from "@/services/access";

export default async function MyTrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("PARTICIPANT");
  return children;
}
