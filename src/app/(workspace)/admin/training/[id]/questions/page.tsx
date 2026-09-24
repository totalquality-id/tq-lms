import { CourseQuestionBank, type QuestionBankFilters } from "@/features/management/course-question-bank";
import { requireAdmin, requireBatchStaff } from "@/services/access";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<QuestionBankFilters>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { batch } = await requireBatchStaff(id);
  return <CourseQuestionBank courseId={batch.courseId} batchId={id} filters={await searchParams} />;
}
