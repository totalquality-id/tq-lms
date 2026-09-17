import { requireRole } from "@/services/access";

export default async function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("CORPORATE_PIC");
  return children;
}
