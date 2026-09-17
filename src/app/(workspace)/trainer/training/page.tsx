import type { Metadata } from "next";

import { StaffTrainingList } from "@/features/training/staff-pages";

export const metadata: Metadata = { title: "Training saya" };

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  return (
    <StaffTrainingList
      base="/trainer/training"
      title="Training saya"
      description="Kelas yang ditugaskan kepada Anda."
      searchParams={searchParams}
    />
  );
}
