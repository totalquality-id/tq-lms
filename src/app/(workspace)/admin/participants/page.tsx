import type { Metadata } from "next";

import { PeoplePage } from "@/features/management/people-page";

export const metadata: Metadata = { title: "Peserta" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; organizationId?: string; page?: string }>;
}) {
  return <PeoplePage role="PARTICIPANT" searchParams={searchParams} />;
}
