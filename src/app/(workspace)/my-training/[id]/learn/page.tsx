import Link from "next/link";

import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { labels, minutes } from "@/lib/utils";
import { buildProgress, myEnrollment } from "@/services/learning";

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enrollment = await myEnrollment(id);
  const progress = buildProgress(enrollment);
  const byLesson = new Map(
    progress.activities
      .filter((activity) => activity.kind === "LESSON")
      .map((activity) => [activity.id, activity]),
  );
  const { modules } = enrollment.batch.course;

  if (!modules.length)
    return (
      <Card>
        <EmptyState
          title="Materi sedang disiapkan"
          description="Trainer akan membagikan modul pembelajaran untuk kelas ini."
        />
      </Card>
    );

  return (
    <div className="space-y-4">
      {modules.map((courseModule, index) => (
        <Card key={courseModule.id}>
          <CardHeader
            title={`Modul ${index + 1} · ${courseModule.title}`}
            description={`${courseModule.lessons.length} pelajaran`}
          />
          <ul className="divide-y divide-ink-100">
            {courseModule.lessons.map((lesson, position) => {
              const activity = byLesson.get(lesson.id);
              const locked = activity?.locked ?? false;
              const done = activity?.done ?? false;
              const number = String(position + 1).padStart(2, "0");

              const body = (
                <>
                  <span className="tabular w-6 shrink-0 text-xs text-ink-400">
                    {number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-900">
                      {lesson.title}
                    </span>
                    <span className="block text-xs text-ink-500">
                      {labels[lesson.type] ?? lesson.type} ·{" "}
                      {minutes(lesson.duration)}
                      {lesson.required ? "" : " · opsional"}
                    </span>
                  </span>
                  <span
                    className={
                      done
                        ? "text-xs font-medium text-[var(--color-success)]"
                        : locked
                          ? "text-xs text-ink-400"
                          : "text-xs text-ink-500"
                    }
                  >
                    {done ? "Selesai" : locked ? "Terkunci" : "Belum dibuka"}
                  </span>
                </>
              );

              return (
                <li key={lesson.id}>
                  {locked ? (
                    <div className="flex items-center gap-3 px-4 py-3 opacity-60 sm:px-5">
                      {body}
                    </div>
                  ) : (
                    <Link
                      href={`/my-training/${id}/learn/${lesson.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5"
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
            {courseModule.lessons.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-ink-500 sm:px-5">
                Belum ada pelajaran pada modul ini.
              </li>
            ) : null}
          </ul>
        </Card>
      ))}
    </div>
  );
}
