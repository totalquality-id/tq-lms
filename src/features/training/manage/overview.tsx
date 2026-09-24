import Link from "@/components/ui/navigation-link";

import { SectionHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  StatCard,
} from "@/components/ui/card";
import { EntityForm } from "@/features/management/entity-form";
import { batchFields, courseFields } from "@/features/management/fields";
import { CourseCurriculum } from "@/features/management/course-curriculum";
import { PreviewDialog } from "@/features/management/preview-dialog";
import { LessonContent } from "@/features/learning/lesson-content";
import { db } from "@/lib/db";
import { dateRange, labels, minutes } from "@/lib/utils";
import { batchOverview } from "@/services/batch";

export async function ManageOverview({ id }: { id: string }) {
  const { batch, admin, issued } = await batchOverview(id);

  const [trainers, courses, organizations] = admin
    ? await Promise.all([
        db.user.findMany({
          where: { role: "TRAINER", active: true, deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.course.findMany({
          where: { deletedAt: null, OR: [{ sourceCourseId: null }, { id: batch.courseId }] },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        }),
        db.organization.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], [], []];

  const lessonCount = batch.course.modules.reduce(
    (total, courseModule) => total + courseModule.lessons.length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Peserta terdaftar"
          value={batch._count.enrollments}
          hint={`Kapasitas ${batch.capacity}`}
        />
        <StatCard label="Penilaian" value={batch._count.assessments} />
        <StatCard label="Tugas" value={batch._count.assignments} />
        <StatCard label="Sertifikat terbit" value={issued} />
      </div>

      <Card>
        <CardHeader
          title="Detail training"
          action={
            admin && batch.status !== "COMPLETED" ? (
              <EntityForm
                entity="batch"
                id={id}
                title="Edit training"
                buttonLabel="Edit"
                size="sm"
                fields={batchFields(courses, organizations, trainers, batch)}
              />
            ) : null
          }
        />
        <CardBody className="space-y-4">
          <DescriptionList
            items={[
              { term: "Kode training", value: batch.code },
              { term: "Course", value: batch.course.title },
              {
                term: "Organisasi",
                value: batch.organization?.name ?? "Training umum",
              },
              {
                term: "Jadwal",
                value: `${dateRange(batch.startDate, batch.endDate)} · ${batch.startTime}–${batch.endTime} WIB`,
              },
              { term: "Metode", value: labels[batch.mode] ?? batch.mode },
              { term: "Lokasi", value: batch.venue || "Belum ditentukan" },
              {
                term: "Trainer",
                value:
                  batch.trainers.map((link) => link.trainer.name).join(", ") ||
                  "Belum ditugaskan",
              },
              {
                term: "Syarat kehadiran",
                value: `Minimum ${batch.minimumAttendance}%`,
              },
            ]}
          />
          {batch.meetingUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a
                href={batch.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka tautan pertemuan
              </a>
            </Button>
          ) : null}
          {batch.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink-600">
              {batch.description}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {admin ? (
        <Card>
          <CardHeader
            title="Trainer"
            description="Trainer yang ditugaskan dapat mengelola presensi, penilaian, dan tugas kelas ini."
            action={
              <EntityForm
                entity="trainer"
                parentId={id}
                title="Tugaskan trainer"
                buttonLabel="Tugaskan trainer"
                size="sm"
                variant="secondary"
                fields={[
                  {
                    name: "trainerId",
                    label: "Trainer",
                    required: true,
                    full: true,
                    options: [
                      { value: "", label: "Pilih trainer" },
                      ...trainers
                        .filter(
                          (trainer) =>
                            !batch.trainers.some(
                              (link) => link.trainerId === trainer.id,
                            ),
                        )
                        .map((trainer) => ({
                          value: trainer.id,
                          label: trainer.name,
                        })),
                    ],
                  },
                ]}
              />
            }
          />
          <CardBody>
            {batch.trainers.length ? (
              <ul className="space-y-1 text-sm text-ink-700">
                {batch.trainers.map((link) => (
                  <li key={link.id}>
                    {link.trainer.name}
                    <span className="text-ink-500">
                      {" "}
                      · {link.trainer.email}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">
                Belum ada trainer yang ditugaskan pada kelas ini.
              </p>
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Course training"
          description="Salinan khusus training ini. Perubahan materi dan soal tidak memengaruhi course induk atau training lain."
          action={admin ? <EntityForm entity="course" id={batch.courseId} title="Edit course training"
            buttonLabel="Edit course training" size="sm"
            fields={courseFields(batch.course).filter((field) => field.name !== "published")} /> : undefined}
        />
        <CardBody className="space-y-3">
          <DescriptionList items={[
            { term: "Judul", value: batch.course.title },
            { term: "Sumber", value: batch.course.sourceCourse?.title ?? "Course induk" },
            { term: "Durasi", value: `${batch.course.duration} jam` },
            { term: "Alur belajar", value: batch.course.sequential ? "Berurutan" : "Bebas" },
          ]} />
          <p className="whitespace-pre-line text-sm text-ink-700">{batch.course.description || batch.course.shortDescription}</p>
          {batch.course.objectives ? <p className="whitespace-pre-line text-sm text-ink-700">{batch.course.objectives}</p> : null}
        </CardBody>
      </Card>

      {admin ? <CourseCurriculum course={batch.course} /> : <section>
        <SectionHeader
          title="Kurikulum course"
          description={`${batch.course.modules.length} modul · ${lessonCount} pelajaran · ${batch.course.duration} jam`}
        />
        <Card>
          {batch.course.modules.length ? (
            <ul className="divide-y divide-ink-100">
              {batch.course.modules.map((courseModule, index) => (
                <li key={courseModule.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-medium text-ink-900">
                    Modul {index + 1} · {courseModule.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {courseModule.lessons.length} pelajaran ·{" "}
                    {minutes(
                      courseModule.lessons.reduce(
                        (total, lesson) => total + lesson.duration,
                        0,
                      ),
                    )}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {courseModule.lessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm text-ink-700">
                          {lesson.title}
                        </span>
                        <PreviewDialog title={lesson.title}>
                          <div className="space-y-4">
                            <p className="text-xs text-ink-500">
                              {labels[lesson.type] ?? lesson.type} ·{" "}
                              {minutes(lesson.duration)}
                            </p>
                            <LessonContent lesson={lesson} />
                          </div>
                        </PreviewDialog>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-sm text-ink-500">
                Course ini belum memiliki modul.
              </p>
            </CardBody>
          )}
        </Card>
      </section>}
    </div>
  );
}
