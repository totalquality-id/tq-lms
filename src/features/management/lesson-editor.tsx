"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileText,
  Image as ImageIcon,
  Info,
  Link2,
  PencilLine,
  Plus,
  Trash2,
  Type,
  Upload,
  Video,
} from "lucide-react";

import { saveLessonAction } from "@/app/actions";
import { signLessonUploadAction } from "@/app/file-actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, FormError } from "@/components/ui/field";
import { UploadProgress, useUpload } from "@/components/ui/file-upload";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LessonContent } from "@/features/learning/lesson-content";
import {
  BLOCK_LABELS,
  LESSON_LIMITS,
  LESSON_TYPES,
  blocksError,
  emptyBlock,
  lessonFileUrl,
  videoEmbedUrl,
  type BlockType,
  type FileRef,
  type LessonBlock,
  type UploadKind,
} from "@/lib/lesson-blocks";
import { fileSize, uploadError } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";

const BLOCK_ICONS: Record<BlockType, typeof Type> = {
  text: Type,
  video: Video,
  image: ImageIcon,
  file: FileText,
  link: Link2,
  callout: Info,
};

const BLOCK_ORDER: BlockType[] = ["text", "video", "image", "file", "link", "callout"];

type Meta = { title: string; duration: number; required: boolean };

/**
 * Editor isi pelajaran: deretan blok yang dapat ditambah, diubah, dipindah,
 * dan dihapus, lalu disimpan sekaligus. Pratinjau memakai komponen yang sama
 * dengan halaman peserta.
 */
export function LessonEditor({
  lessonId,
  initialMeta,
  initialBlocks,
}: {
  lessonId: string;
  initialMeta: Meta;
  initialBlocks: LessonBlock[];
}) {
  const router = useRouter();
  const [meta, setMeta] = useState(initialMeta);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState(0);
  const [saving, start] = useTransition();

  // Mencegah perubahan hilang saat tab ditutup atau dimuat ulang.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeMeta(patch: Partial<Meta>) {
    setMeta((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function update(id: string, patch: Partial<LessonBlock>) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? ({ ...block, ...patch } as LessonBlock) : block,
      ),
    );
    setDirty(true);
  }

  function add(type: BlockType) {
    const block = emptyBlock(type, crypto.randomUUID());
    setBlocks((current) => [...current, block]);
    setDirty(true);
    requestAnimationFrame(() =>
      document
        .getElementById(`block-${block.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
    setDirty(true);
  }

  function remove(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
    setDirty(true);
  }

  function save() {
    setError(null);
    if (meta.title.trim().length < 2) return setError("Judul pelajaran minimal 2 karakter.");
    const problem = blocksError(blocks);
    if (problem) return setError(problem);
    start(async () => {
      const result = await saveLessonAction(lessonId, { ...meta, blocks });
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setDirty(false);
      router.refresh();
    });
  }

  const busy = saving || uploads > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Judul pelajaran" htmlFor="lesson-title" required>
            <Input
              id="lesson-title"
              value={meta.title}
              maxLength={200}
              onChange={(event) => changeMeta({ title: event.target.value })}
            />
          </Field>
          <Field label="Durasi (menit)" htmlFor="lesson-duration" required>
            <Input
              id="lesson-duration"
              type="number"
              min={1}
              max={600}
              value={meta.duration}
              onChange={(event) =>
                changeMeta({ duration: Number(event.target.value) || 1 })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-brand-600"
              checked={meta.required}
              onChange={(event) => changeMeta({ required: event.target.checked })}
            />
            Wajib diselesaikan untuk menghitung progres dan sertifikat
          </label>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-500">
          {blocks.length} blok konten
        </p>
        <div className="inline-flex rounded-md border border-ink-300 bg-white p-0.5" role="tablist" aria-label="Mode editor">
          <ModeButton active={!preview} onClick={() => setPreview(false)}>
            <PencilLine aria-hidden /> Edit
          </ModeButton>
          <ModeButton active={preview} onClick={() => setPreview(true)}>
            <Eye aria-hidden /> Pratinjau peserta
          </ModeButton>
        </div>
      </div>

      {preview ? (
        <Card>
          <CardBody>
            <h2 className="mb-4 text-lg font-semibold text-ink-900">{meta.title}</h2>
            <LessonContent lessonId={lessonId} blocks={blocks} />
          </CardBody>
        </Card>
      ) : (
        <>
          {blocks.map((block, index) => (
            <BlockCard
              key={block.id}
              block={block}
              index={index}
              first={index === 0}
              last={index === blocks.length - 1}
              onMove={(direction) => move(index, direction)}
              onRemove={() => remove(block.id)}
            >
              <BlockFields
                lessonId={lessonId}
                block={block}
                onChange={(patch) => update(block.id, patch)}
                onUploading={(active) => setUploads((count) => count + (active ? 1 : -1))}
              />
            </BlockCard>
          ))}

          {blocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink-300 bg-white px-6 py-10 text-center">
              <p className="text-sm font-medium text-ink-800">Pelajaran ini belum berisi apa pun</p>
              <p className="mt-1 text-sm text-ink-500">
                Mulai dengan blok teks, lalu tambahkan video, gambar, atau dokumen pendukung.
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-ink-200 bg-white p-3">
            <p className="mb-2 px-1 text-xs font-medium tracking-wide text-ink-500 uppercase">
              Tambah blok
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {BLOCK_ORDER.map((type) => {
                const Icon = BLOCK_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => add(type)}
                    className="flex items-center gap-2 rounded-md border border-ink-200 px-3 py-2 text-sm text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Plus className="size-3.5 text-ink-400" aria-hidden />
                    <Icon className="size-4" aria-hidden />
                    {BLOCK_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="sticky bottom-0 z-30 -mx-1 rounded-t-lg border border-b-0 border-ink-200 bg-white/95 shadow-[var(--shadow-overlay)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            {error ? (
              <FormError>{error}</FormError>
            ) : (
              <p className="text-sm text-ink-500">
                {uploads > 0
                  ? "Menunggu unggahan selesai…"
                  : dirty
                    ? "Ada perubahan yang belum disimpan."
                    : "Semua perubahan tersimpan."}
              </p>
            )}
          </div>
          <Button type="button" onClick={save} disabled={busy || !dirty}>
            {saving ? "Menyimpan…" : "Simpan pelajaran"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium [&_svg]:size-3.5",
        active ? "bg-brand-600 text-white" : "text-ink-600 hover:text-ink-900",
      )}
    >
      {children}
    </button>
  );
}

function BlockCard({
  block,
  index,
  first,
  last,
  onMove,
  onRemove,
  children,
}: {
  block: LessonBlock;
  index: number;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const Icon = BLOCK_ICONS[block.type];
  const [confirming, setConfirming] = useState(false);
  return (
    <section
      id={`block-${block.id}`}
      aria-label={`Blok ${index + 1}: ${BLOCK_LABELS[block.type]}`}
      className="rounded-lg border border-ink-200 bg-white shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
        <span className="tabular w-5 text-xs text-ink-400">{index + 1}</span>
        <Icon className="size-4 text-ink-500" aria-hidden />
        <span className="flex-1 text-sm font-medium text-ink-800">
          {BLOCK_LABELS[block.type]}
        </span>
        {confirming ? (
          <>
            <span className="text-xs text-ink-600">Hapus blok ini?</span>
            <Button type="button" size="sm" variant="danger" onClick={onRemove}>
              Hapus
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Batal
            </Button>
          </>
        ) : (
          <>
            <IconButton label="Pindah ke atas" disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp />
            </IconButton>
            <IconButton label="Pindah ke bawah" disabled={last} onClick={() => onMove(1)}>
              <ArrowDown />
            </IconButton>
            <IconButton label="Hapus blok" onClick={() => setConfirming(true)} danger>
              <Trash2 />
            </IconButton>
          </>
        )}
      </div>
      <div className="space-y-3 p-3 sm:p-4">{children}</div>
    </section>
  );
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30 [&_svg]:size-4",
        danger ? "hover:bg-danger-bg hover:text-danger" : "",
      )}
    >
      {children}
    </button>
  );
}

function BlockFields({
  lessonId,
  block,
  onChange,
  onUploading,
}: {
  lessonId: string;
  block: LessonBlock;
  onChange: (patch: Partial<LessonBlock>) => void;
  onUploading: (active: boolean) => void;
}) {
  const id = useId();

  switch (block.type) {
    case "text":
      return (
        <RichTextEditor
          label="Isi teks"
          value={block.html}
          onChange={(html) => onChange({ html })}
        />
      );

    case "video": {
      const mode = block.file ? "upload" : "embed";
      const embedValid = !block.url || videoEmbedUrl(block.url);
      return (
        <>
          <VideoSource
            mode={mode}
            hasUrl={!!block.url}
            onPick={(next) =>
              next === "embed" ? onChange({ file: null }) : onChange({ url: "" })
            }
          />
          <Field
            label="Tautan video"
            htmlFor={`${id}-url`}
            hint="YouTube (boleh unlisted), Vimeo, atau Google Drive yang dibagikan. Cocok untuk video panjang."
            error={embedValid ? null : "Tautan harus dari YouTube, Vimeo, atau Google Drive."}
          >
            <Input
              id={`${id}-url`}
              value={block.url}
              disabled={!!block.file}
              placeholder="https://www.youtube.com/watch?v=…"
              onChange={(event) => onChange({ url: event.target.value })}
            />
          </Field>
          <p className="text-center text-xs text-ink-400">atau</p>
          <FileInput
            lessonId={lessonId}
            kind="video"
            file={block.file}
            disabled={!!block.url}
            label="Unggah video MP4/WebM"
            onChange={(file) => onChange({ file, url: "" })}
            onUploading={onUploading}
          />
          <Field label="Keterangan (opsional)" htmlFor={`${id}-caption`}>
            <Input
              id={`${id}-caption`}
              value={block.caption}
              maxLength={500}
              onChange={(event) => onChange({ caption: event.target.value })}
            />
          </Field>
        </>
      );
    }

    case "image":
      return (
        <>
          <FileInput
            lessonId={lessonId}
            kind="image"
            file={block.file}
            label="Unggah gambar"
            onChange={(file) => onChange({ file })}
            onUploading={onUploading}
          />
          {block.file ? (
            <img
              src={lessonFileUrl(lessonId, block.file)}
              alt=""
              className="max-h-64 rounded-md border border-ink-200"
            />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Teks alternatif"
              htmlFor={`${id}-alt`}
              required
              hint="Jelaskan isi gambar untuk peserta yang memakai pembaca layar."
            >
              <Input
                id={`${id}-alt`}
                value={block.alt}
                maxLength={300}
                onChange={(event) => onChange({ alt: event.target.value })}
              />
            </Field>
            <Field label="Keterangan (opsional)" htmlFor={`${id}-caption`}>
              <Input
                id={`${id}-caption`}
                value={block.caption}
                maxLength={500}
                onChange={(event) => onChange({ caption: event.target.value })}
              />
            </Field>
          </div>
        </>
      );

    case "file":
      return (
        <>
          <FileInput
            lessonId={lessonId}
            kind="file"
            file={block.file}
            label="Unggah dokumen"
            hint="PDF ditampilkan langsung di halaman. PPT, Word, dan Excel tampil sebagai berkas unduhan — untuk dibaca langsung, unggah juga versi PDF-nya."
            onChange={(file) => onChange({ file })}
            onUploading={onUploading}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Judul (opsional)" htmlFor={`${id}-title`} hint="Kosongkan untuk memakai nama berkas.">
              <Input
                id={`${id}-title`}
                value={block.title}
                maxLength={200}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </Field>
            <Field label="Keterangan (opsional)" htmlFor={`${id}-description`}>
              <Input
                id={`${id}-description`}
                value={block.description}
                maxLength={500}
                onChange={(event) => onChange({ description: event.target.value })}
              />
            </Field>
          </div>
        </>
      );

    case "link":
      return (
        <>
          <Field label="Alamat tautan" htmlFor={`${id}-url`} required>
            <Input
              id={`${id}-url`}
              type="url"
              value={block.url}
              placeholder="https://"
              onChange={(event) => onChange({ url: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Judul (opsional)" htmlFor={`${id}-title`}>
              <Input
                id={`${id}-title`}
                value={block.title}
                maxLength={200}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </Field>
            <Field label="Keterangan (opsional)" htmlFor={`${id}-description`}>
              <Input
                id={`${id}-description`}
                value={block.description}
                maxLength={500}
                onChange={(event) => onChange({ description: event.target.value })}
              />
            </Field>
          </div>
        </>
      );

    case "callout":
      return (
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label="Jenis" htmlFor={`${id}-tone`}>
            <Select
              id={`${id}-tone`}
              value={block.tone}
              onChange={(event) =>
                onChange({ tone: event.target.value as "info" | "tip" | "warning" })
              }
            >
              <option value="info">Info</option>
              <option value="tip">Tips</option>
              <option value="warning">Perhatian</option>
            </Select>
          </Field>
          <Field label="Isi catatan" htmlFor={`${id}-text`} required>
            <Textarea
              id={`${id}-text`}
              value={block.text}
              maxLength={2000}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          </Field>
        </div>
      );
  }
}

function VideoSource({
  mode,
  hasUrl,
  onPick,
}: {
  mode: "upload" | "embed";
  hasUrl: boolean;
  onPick: (mode: "upload" | "embed") => void;
}) {
  if (mode === "upload")
    return (
      <p className="text-xs text-ink-500">
        Video diunggah ke penyimpanan privat.{" "}
        <button type="button" className="text-brand-700 underline" onClick={() => onPick("embed")}>
          Ganti dengan tautan
        </button>
      </p>
    );
  if (hasUrl)
    return (
      <p className="text-xs text-ink-500">
        Video disematkan dari tautan.{" "}
        <button type="button" className="text-brand-700 underline" onClick={() => onPick("upload")}>
          Ganti dengan unggahan
        </button>
      </p>
    );
  return null;
}

/**
 * Memilih lalu mengunggah satu berkas langsung ke penyimpanan. Jenis dan
 * ukuran diperiksa di peramban dulu supaya penolakan yang jelas tidak perlu
 * menunggu server; pemeriksaan yang menentukan tetap terjadi saat disimpan.
 */
function FileInput({
  lessonId,
  kind,
  file,
  label,
  hint,
  disabled,
  onChange,
  onUploading,
}: {
  lessonId: string;
  kind: UploadKind;
  file: FileRef | null;
  label: string;
  hint?: string;
  disabled?: boolean;
  onChange: (file: FileRef | null) => void;
  onUploading: (active: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUpload();
  const [picked, setPicked] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = [...LESSON_TYPES[kind]];
  const max = LESSON_LIMITS[kind];

  async function choose(selected: File | undefined) {
    if (input.current) input.current.value = "";
    if (!selected) return;
    setError(null);
    const invalid = uploadError(selected.name, selected.size, max, allowed);
    if (invalid) return setError(invalid);

    setPicked(selected);
    onUploading(true);
    try {
      const signed = await signLessonUploadAction(lessonId, kind, {
        name: selected.name,
        size: selected.size,
      });
      if (!signed.upload) throw new Error(signed.error ?? "Unggahan ditolak.");
      await upload.run(signed.upload.url, selected);
      onChange({ key: signed.upload.key, name: selected.name, size: selected.size });
    } catch (failed) {
      setError(failed instanceof Error ? failed.message : "Unggahan gagal.");
    } finally {
      setPicked(null);
      onUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={allowed.map((item) => `.${item}`).join(",")}
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {file ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-ink-200 bg-ink-25 px-3 py-2">
          <FileText className="size-4 text-ink-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">{file.name}</p>
            <p className="text-xs text-ink-500">{fileSize(file.size)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={upload.busy || disabled}
            onClick={() => input.current?.click()}
          >
            Ganti
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Lepas
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={upload.busy || disabled}
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-md border border-dashed border-ink-300 bg-ink-25 px-4 py-5 text-sm text-ink-600 hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="size-5 text-ink-400" aria-hidden />
          <span className="font-medium">{label}</span>
          <span className="text-xs text-ink-500">
            {allowed.map((item) => `.${item}`).join(", ")} · maks. {fileSize(max)}
          </span>
        </button>
      )}
      <UploadProgress progress={upload.progress} file={picked} />
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
