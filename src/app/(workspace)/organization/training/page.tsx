import type { Metadata } from "next";

import { StaffTrainingList } from "@/features/training/staff-pages";

export const metadata: Metadata = { title: "Training perusahaan" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  return (
    <StaffTrainingList
      base="/organization/training"
      title="Training perusahaan"
      description="Pelatihan yang diselenggarakan untuk organisasi Anda."
      searchParams={searchParams}
    />
  );
}
