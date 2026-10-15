import type { Metadata } from "next";

import { ReviewQueue } from "@/features/training/review-queue";

export const metadata: Metadata = { title: "Penilaian" };

export default function ReviewsPage() {
  return <ReviewQueue />;
}
