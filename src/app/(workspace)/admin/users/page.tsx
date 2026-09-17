import type { Metadata } from "next";

import { PeoplePage } from "@/features/management/people-page";

export const metadata: Metadata = { title: "Pengguna" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; organizationId?: string; page?: string }>;
}) {
  return <PeoplePage searchParams={searchParams} />;
}
