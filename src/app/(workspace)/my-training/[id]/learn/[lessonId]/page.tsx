import Link from "@/components/ui/navigation-link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LessonContent } from "@/features/learning/lesson-content";
import { LessonComplete } from "@/features/learning/lesson-complete";
import { labels, minutes } from "@/lib/utils";
import { buildProgress, myEnrollment } from "@/services/learning";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const enrollment = await myEnrollment(id);
  const progress = buildProgress(enrollment);

  const courseModule = enrollment.batch.course.modules.find((item) =>
    item.lessons.some((lesson) => lesson.id === lessonId),
  );
  const lesson = courseModule?.lessons.find((item) => item.id === lessonId);
  if (!courseModule || !lesson) notFound();

  const lessons = progress.activities.filter(
    (activity) => activity.kind === "LESSON",
  );
  const index = lessons.findIndex((activity) => activity.id === lessonId);
  const activity = lessons[index];

  if (activity?.locked)
    return (
      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm font-medium text-ink-800">
            Pelajaran ini masih terkunci
          </p>
          <p className="text-sm text-ink-500">
            Course ini disusun berurutan. Selesaikan aktivitas wajib sebelumnya
            untuk membukanya.
          </p>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/my-training/${id}/learn`}>
              Kembali ke daftar materi
            </Link>
          </Button>
        </CardBody>
      </Card>
    );

  const previous = index > 0 ? lessons[index - 1] : null;
  const next =
    index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { href: `/my-training/${id}/learn`, label: "Materi" },
          { label: courseModule.title },
        ]}
      />

      <Card>
        <CardHeader
          title={lesson.title}
          description={`${labels[lesson.type] ?? lesson.type} · ${minutes(lesson.duration)}`}
        />
        <CardBody className="space-y-5">
          <LessonContent lesson={lesson} />
        </CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-4 py-3 sm:px-5">
          <LessonComplete
            batchId={id}
            lessonId={lessonId}
            done={activity?.done ?? false}
            nextHref={next?.locked === false ? next.href : undefined}
          />
          <div className="flex gap-2">
            {previous ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={previous.href}>Sebelumnya</Link>
              </Button>
            ) : null}
            {next ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={next.href}>Berikutnya</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
