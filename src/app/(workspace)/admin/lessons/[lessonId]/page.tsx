import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { LessonEditor } from "@/features/management/lesson-editor";
import { lessonForEditor } from "@/services/lesson";

export const metadata: Metadata = { title: "Edit pelajaran" };

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const data = await lessonForEditor(lessonId);
  if (!data) notFound();
  const { lesson, blocks, back } = data;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={lesson.title}
        description={`Modul: ${lesson.module.title} · ${back.label}`}
        backHref={back.href}
        backLabel={`Kembali ke ${back.label}`}
      />
      <LessonEditor
        lessonId={lesson.id}
        initialMeta={{
          title: lesson.title,
          duration: lesson.duration,
          required: lesson.required,
        }}
        initialBlocks={blocks}
      />
    </div>
  );
}
