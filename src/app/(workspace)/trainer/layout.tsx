import { requireRole } from "@/services/access";

export default async function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("TRAINER");
  return children;
}
