import type { Prisma } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { SectionHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { EntityForm, ReorderButtons } from "@/features/management/entity-form";
import { lessonFields } from "@/features/management/fields";
import { PreviewDialog } from "@/features/management/preview-dialog";
import { LessonContent } from "@/features/learning/lesson-content";
import { labels, minutes } from "@/lib/utils";

const moduleField = (title?: string) => [{ name: "title", label: "Judul modul", required: true, full: true, defaultValue: title }];

type Course = Prisma.CourseGetPayload<{ include: { modules: { include: { lessons: true } } } }>;

export function CourseCurriculum({ course }: { course: Course }) {
  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);
  return (
        <div className="space-y-4">
          <SectionHeader
            title="Kurikulum"
            description={`${course.modules.length} modul · ${lessonCount} pelajaran`}
            action={
              <EntityForm
                entity="module"
                parentId={course.id}
                title="Tambah modul"
                size="sm"
                fields={moduleField()}
                icon
              />
            }
          />

          {course.modules.map((courseModule, index) => (
            <Card key={courseModule.id}>
              <CardHeader
                title={`Modul ${index + 1} · ${courseModule.title}`}
                description={`${courseModule.lessons.length} pelajaran`}
                action={
                  <div className="flex items-center gap-1">
                    <ReorderButtons
                      entity="module"
                      id={courseModule.id}
                      first={index === 0}
                      last={index === course.modules.length - 1}
                    />
                    <EntityForm
                      entity="module"
                      id={courseModule.id}
                      parentId={course.id}
                      title="Edit modul"
                      buttonLabel="Edit"
                      size="sm"
                      variant="ghost"
                      fields={moduleField(courseModule.title)}
                    />
                  </div>
                }
              />
              <ul className="divide-y divide-ink-100">
                {courseModule.lessons.map((lesson, position) => (
                  <li
                    key={lesson.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <span className="tabular w-6 shrink-0 text-xs text-ink-400">
                      {String(position + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-900">
                        {lesson.title}
                      </p>
                      <p className="text-xs text-ink-500">
                        {labels[lesson.type] ?? lesson.type} ·{" "}
                        {minutes(lesson.duration)}
                        {lesson.required ? "" : " · opsional"}
                      </p>
                    </div>
                    <PreviewDialog title={lesson.title}>
                      <div className="space-y-4">
                        <p className="text-xs text-ink-500">
                          {labels[lesson.type] ?? lesson.type} ·{" "}
                          {minutes(lesson.duration)}
                        </p>
                        <LessonContent lesson={lesson} />
                      </div>
                    </PreviewDialog>
                    {lesson.resourceUrl ? (
                      <a
                        href={lesson.resourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buka materi ${lesson.title}`}
                        className="text-ink-400 hover:text-brand-600"
                      >
                        <ExternalLink className="size-4" aria-hidden />
                      </a>
                    ) : null}
                    <ReorderButtons
                      entity="lesson"
                      id={lesson.id}
                      first={position === 0}
                      last={position === courseModule.lessons.length - 1}
                    />
                    <EntityForm
                      entity="lesson"
                      id={lesson.id}
                      parentId={courseModule.id}
                      title="Edit pelajaran"
                      buttonLabel="Edit"
                      size="sm"
                      variant="ghost"
                      fields={lessonFields(lesson)}
                    />
                  </li>
                ))}
                {courseModule.lessons.length === 0 ? (
                  <li className="px-4 py-4 text-sm text-ink-500 sm:px-5">
                    Modul ini belum memiliki pelajaran.
                  </li>
                ) : null}
              </ul>
              <div className="border-t border-ink-200 px-4 py-3 sm:px-5">
                <EntityForm
                  entity="lesson"
                  parentId={courseModule.id}
                  title="Tambah pelajaran"
                  size="sm"
                  variant="secondary"
                  fields={lessonFields()}
                />
              </div>
            </Card>
          ))}

          {course.modules.length === 0 ? (
            <Card>
              <EmptyState
                title="Belum ada modul"
                description="Tambahkan modul lalu isi dengan artikel, video, atau tautan materi."
                action={
                  <EntityForm
                    entity="module"
                    parentId={course.id}
                    title="Tambah modul"
                    size="sm"
                    fields={moduleField()}
                  />
                }
              />
            </Card>
          ) : null}
        </div>
  );
}
