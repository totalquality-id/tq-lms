import type { Metadata } from "next";

import { ReportPage } from "@/features/reports/report-page";
import { requireAdmin } from "@/services/access";

export const metadata: Metadata = { title: "Laporan" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    batchId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireAdmin();
  return <ReportPage searchParams={searchParams} />;
}
