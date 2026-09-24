import { notFound } from "next/navigation";

import {
  Breadcrumb,
  PageHeader,
} from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
} from "@/components/ui/card";
import {
  ArchiveButton,
  EntityForm,
} from "@/features/management/entity-form";
import { courseFields } from "@/features/management/fields";
import { CourseCurriculum } from "@/features/management/course-curriculum";
import { db } from "@/lib/db";
import { requireAdmin } from "@/services/access";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const course = await db.course.findFirst({
    where: { id, sourceCourseId: null, deletedAt: null },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
      _count: { select: { copies: { where: { batches: { some: {} } } }, questions: true } },
    },
  });
  if (!course) notFound();

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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <CourseCurriculum course={course} />

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
                    value: `${course._count.copies} training`,
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
