import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import {
  LESSON_LIMITS,
  LESSON_PREFIX,
  LESSON_TYPES,
  blocksError,
  lessonBlockSchema,
  primaryType,
  readBlocks,
  type FileRef,
  type LessonBlock,
  type UploadKind,
} from "@/lib/lesson-blocks";
import { cleanRichText } from "@/lib/rich-text";
import { extensionOf } from "@/lib/upload";
import { requireAdmin } from "./access";
import { confirmUpload } from "./file";

/**
 * Pelajaran untuk halaman editor, beserta alamat kembali: course induk
 * kembali ke halaman course, salinan khusus training kembali ke training-nya.
 */
export async function lessonForEditor(lessonId: string) {
  await requireAdmin();
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, module: { course: { deletedAt: null } } },
    include: {
      module: {
        include: {
          course: {
            select: {
              id: true,
              title: true,
              sourceCourseId: true,
              batches: { select: { id: true, title: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!lesson) return null;
  const { course } = lesson.module;
  const batch = course.sourceCourseId ? course.batches[0] : undefined;
  return {
    lesson,
    blocks: readBlocks(lesson.blocks),
    back: batch
      ? { href: `/admin/training/${batch.id}`, label: batch.title }
      : { href: `/admin/courses/${course.id}`, label: course.title },
  };
}

const lessonInput = z.object({
  title: z.string().trim().min(2, "Judul minimal 2 karakter.").max(200),
  duration: z.coerce.number().int().min(1).max(600),
  required: z.boolean(),
  blocks: z.array(lessonBlockSchema).max(100, "Maksimal 100 blok per pelajaran."),
});

export type LessonInput = z.input<typeof lessonInput>;

const uploadKind = (block: LessonBlock): UploadKind | null =>
  block.type === "video" || block.type === "image" || block.type === "file"
    ? block.type
    : null;

/**
 * Menyimpan judul, durasi, dan seluruh blok pelajaran sekaligus.
 *
 * Berkas yang baru dirujuk diperiksa ke penyimpanan: harus benar-benar ada,
 * berjenis sesuai bloknya, dan di bawah batas ukuran. Ukuran yang tersimpan
 * diambil dari penyimpanan, bukan dari isian peramban. Berkas yang sudah
 * dirujuk sebelumnya — termasuk milik course induk pada salinan training —
 * tidak diperiksa ulang.
 */
export async function saveLesson(lessonId: string, input: LessonInput) {
  await requireAdmin();
  const data = lessonInput.parse(input);
  const lesson = await db.lesson.findFirstOrThrow({
    where: { id: lessonId, module: { course: { deletedAt: null } } },
    select: { blocks: true },
  });
  const known = new Set(
    readBlocks(lesson.blocks).flatMap((block) =>
      "file" in block && block.file ? [block.file.key] : [],
    ),
  );

  const blocks: LessonBlock[] = [];
  for (const block of data.blocks) {
    if (block.type === "text") {
      blocks.push({ ...block, html: cleanRichText(block.html) });
      continue;
    }
    if (block.type === "video" && block.file) block.url = "";
    const kind = uploadKind(block);
    const file = "file" in block ? block.file : null;
    if (kind && file && !known.has(file.key)) {
      if (!(LESSON_TYPES[kind] as readonly string[]).includes(extensionOf(file.name)))
        throw new Error(`Jenis berkas ${file.name} tidak sesuai untuk blok ini.`);
      const info = await confirmUpload(file.key, LESSON_LIMITS[kind], LESSON_PREFIX);
      (block as { file: FileRef }).file = { ...file, size: info.size };
    }
    blocks.push(block);
  }

  const problem = blocksError(blocks);
  if (problem) throw new Error(problem);

  await db.lesson.update({
    where: { id: lessonId },
    data: {
      title: data.title,
      duration: data.duration,
      required: data.required,
      blocks,
      type: primaryType(blocks),
    },
  });
}
