import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Info,
  Lightbulb,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/field";
import {
  isPdf,
  lessonFileUrl,
  videoEmbedUrl,
  type LessonBlock,
} from "@/lib/lesson-blocks";
import { extensionOf, fileSize } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * Isi pelajaran seperti yang dilihat peserta. Tanpa hook, sehingga dipakai
 * bersama oleh halaman peserta (server) dan pratinjau editor (peramban).
 *
 * HTML blok teks sudah dibersihkan di server saat disimpan, jadi aman
 * ditampilkan langsung.
 */
export function LessonContent({
  lessonId,
  blocks,
}: {
  lessonId: string;
  blocks: LessonBlock[];
}) {
  if (!blocks.length)
    return <Note>Isi pelajaran ini belum ditambahkan oleh trainer.</Note>;

  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <Block key={block.id} lessonId={lessonId} block={block} />
      ))}
    </div>
  );
}

function Block({ lessonId, block }: { lessonId: string; block: LessonBlock }) {
  switch (block.type) {
    case "text":
      return (
        <div
          className="rich-text"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );

    case "video": {
      const embed = block.file ? null : videoEmbedUrl(block.url);
      return (
        <figure className="space-y-2">
          {block.file ? (
            <video
              controls
              preload="metadata"
              controlsList="nodownload"
              className="aspect-video w-full rounded-lg bg-ink-900"
              src={lessonFileUrl(lessonId, block.file)}
            >
              Peramban Anda tidak dapat memutar video ini.
            </video>
          ) : embed ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-ink-900">
              <iframe
                src={embed}
                title={block.caption || "Video pelajaran"}
                className="size-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : block.url ? (
            <Button asChild variant="secondary" size="sm">
              <a href={block.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Putar video
              </a>
            </Button>
          ) : null}
          {block.caption ? (
            <figcaption className="text-xs text-ink-500">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case "image":
      return block.file ? (
        <figure className="space-y-2">
          {/* Gambar privat lewat rute berwenang; next/image tidak dapat
              mengoptimalkan tautan bertanda tangan yang berubah-ubah. */}
          <img
            src={lessonFileUrl(lessonId, block.file)}
            alt={block.alt}
            loading="lazy"
            className="mx-auto max-h-[36rem] w-auto max-w-full rounded-lg border border-ink-200"
          />
          {block.caption ? (
            <figcaption className="text-center text-xs text-ink-500">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : null;

    case "file": {
      if (!block.file) return null;
      const view = lessonFileUrl(lessonId, block.file);
      const download = lessonFileUrl(lessonId, block.file, true);
      const title = block.title || block.file.name;
      return (
        <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
              <FileText className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">
                {title}
              </p>
              <p className="text-xs text-ink-500">
                {extensionOf(block.file.name).toUpperCase()} ·{" "}
                {fileSize(block.file.size)}
                {block.description ? ` · ${block.description}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {isPdf(block.file) ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={view} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden />
                    Buka
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="secondary" size="sm">
                <a href={download}>
                  <Download aria-hidden />
                  Unduh
                </a>
              </Button>
            </div>
          </div>
          {isPdf(block.file) ? (
            <iframe
              src={view}
              title={title}
              loading="lazy"
              className="hidden h-[75vh] w-full border-t border-ink-200 sm:block"
            />
          ) : null}
        </div>
      );
    }

    case "link":
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-ink-100 text-ink-600">
            <ExternalLink className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">
              {block.title || block.url}
            </p>
            <p className="truncate text-xs text-ink-500">
              {block.description || hostOf(block.url)}
            </p>
          </div>
        </a>
      );

    case "callout": {
      const tone = CALLOUT[block.tone];
      return (
        <div
          className={cn(
            "flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed",
            tone.className,
          )}
        >
          <tone.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="whitespace-pre-line">
            <span className="sr-only">{tone.label}: </span>
            {block.text}
          </p>
        </div>
      );
    }
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const CALLOUT = {
  info: {
    icon: Info,
    label: "Info",
    className: "border-brand-200 bg-brand-50 text-brand-800",
  },
  tip: {
    icon: Lightbulb,
    label: "Tips",
    className: "border-success/30 bg-success-bg text-success",
  },
  warning: {
    icon: AlertTriangle,
    label: "Perhatian",
    className: "border-warning/30 bg-warning-bg text-warning",
  },
} as const;
