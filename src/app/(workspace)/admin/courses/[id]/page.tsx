import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { Breadcrumb, PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import {
  ArchiveButton,
  EntityForm,
  ReorderButtons,
} from "@/features/management/entity-form";
import { courseFields, lessonFields } from "@/features/management/fields";
import { db } from "@/lib/db";
import { labels, minutes } from "@/lib/utils";
import { requireAdmin } from "@/services/access";

const moduleField = (title?: string) => [
  {
    name: "title",
    label: "Judul modul",
    required: true,
    full: true,
    defaultValue: title,
  },
];

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const course = await db.course.findFirst({
    where: { id, deletedAt: null },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
      _count: { select: { batches: true, questions: true } },
    },
  });
  if (!course) notFound();

  const lessonCount = course.modules.reduce(
    (total, courseModule) => total + courseModule.lessons.length,
    0,
  );

  return (
    <div>
      <Breadcrumb
        items={[
          { href: "/admin/courses", label: "Course" },
          { label: course.title },
        ]}
      />
      <PageHeader
        title={course.title}
        description={course.shortDescription}
        meta={<StatusBadge value={course.published ? "PUBLISHED" : "DRAFT"} />}
        action={
          <EntityForm
            entity="course"
            id={id}
            title="Edit course"
            buttonLabel="Edit course"
            fields={courseFields(course)}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionHeader
            title="Kurikulum"
            description={`${course.modules.length} modul · ${lessonCount} pelajaran`}
            action={
              <EntityForm
                entity="module"
                parentId={id}
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
                      parentId={id}
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
                    parentId={id}
                    title="Tambah modul"
                    size="sm"
                    fields={moduleField()}
                  />
                }
              />
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Informasi course" />
            <CardBody>
              <DescriptionList
                className="sm:grid-cols-1"
                items={[
                  { term: "Kategori", value: course.category },
                  { term: "Kode sertifikat", value: course.code },
                  { term: "Durasi", value: `${course.duration} jam` },
                  {
                    term: "Nilai kelulusan",
                    value: `${course.passingGrade} dari 100`,
                  },
                  {
                    term: "Alur belajar",
                    value: course.sequential
                      ? "Berurutan — modul terkunci sampai aktivitas sebelumnya selesai"
                      : "Bebas — peserta dapat membuka materi mana saja",
                  },
                  {
                    term: "Dipakai",
                    value: `${course._count.batches} training`,
                  },
                  {
                    term: "Bank soal",
                    value: `${course._count.questions} soal`,
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tujuan pembelajaran" />
            <CardBody>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-700">
                {course.objectives || "Belum ditambahkan."}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Deskripsi" />
            <CardBody>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-700">
                {course.description || course.shortDescription}
              </p>
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <ArchiveButton
              entity="course"
              id={id}
              variant="secondary"
              description="Course disembunyikan dari daftar. Training yang sudah memakainya tetap berjalan dan riwayatnya tersimpan."
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
