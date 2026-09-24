import type { Lesson } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/field";

export function LessonContent({
  lesson,
}: {
  lesson: Pick<Lesson, "type" | "content" | "resourceUrl">;
}) {
  return (
    <div className="space-y-5">
      {lesson.content ? (
        <div className="text-sm leading-relaxed whitespace-pre-line text-ink-700">
          {lesson.content}
        </div>
      ) : null}

      {lesson.resourceUrl ? (
        lesson.type === "VIDEO" ? (
          <div className="space-y-2">
            <Button asChild variant="secondary" size="sm">
              <a
                href={lesson.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden />
                Putar video
              </a>
            </Button>
            <p className="text-xs text-ink-500">
              Video dibuka di penyedia aslinya. Ketentuan akses mengikuti
              penyedia tersebut.
            </p>
          </div>
        ) : (
          <Button asChild variant="secondary" size="sm">
            <a
              href={lesson.resourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden />
              Buka materi
            </a>
          </Button>
        )
      ) : null}

      {!lesson.content && !lesson.resourceUrl ? (
        <Note>Isi pelajaran ini belum ditambahkan oleh trainer.</Note>
      ) : null}
    </div>
  );
}
