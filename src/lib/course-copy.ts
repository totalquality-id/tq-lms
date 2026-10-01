import type { Prisma } from "@prisma/client";

type SourceCourse = Prisma.CourseGetPayload<{
  include: { modules: { include: { lessons: true } } };
}>;

/** Salin kurikulum, bukan identitas/riwayatnya. Soal disalin oleh syncCopyQuestions. */
export function courseCopyData(source: SourceCourse, actorId: string) {
  const id = `tc_${crypto.randomUUID()}`;
  return {
    id,
    slug: id,
    sourceCourseId: source.id,
    title: source.title,
    code: source.code,
    shortDescription: source.shortDescription,
    description: source.description,
    objectives: source.objectives,
    category: source.category,
    thumbnail: source.thumbnail,
    published: source.published,
    duration: source.duration,
    passingGrade: source.passingGrade,
    sequential: source.sequential,
    createdBy: actorId,
    modules: {
      create: source.modules.map((module) => ({
        title: module.title,
        position: module.position,
        lessons: {
          create: module.lessons.map((lesson) => ({
            title: lesson.title,
            type: lesson.type,
            content: lesson.content,
            resourceUrl: lesson.resourceUrl,
            duration: lesson.duration,
            position: lesson.position,
            required: lesson.required,
          })),
        },
      })),
    },
  } satisfies Prisma.CourseUncheckedCreateInput;
}