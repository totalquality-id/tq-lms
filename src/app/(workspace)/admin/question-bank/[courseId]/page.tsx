import type { Metadata } from "next";
import { CourseQuestionBank, type QuestionBankFilters } from "@/features/management/course-question-bank";
export const metadata: Metadata = { title: "Kelola soal" };
export default async function Page({ params, searchParams }: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<QuestionBankFilters>;
}) {
  const { courseId } = await params;
  return <CourseQuestionBank courseId={courseId} filters={await searchParams} />;
}
