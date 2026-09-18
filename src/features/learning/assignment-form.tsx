"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { signSubmissionUploadAction } from "@/app/file-actions";
import { submitAssignmentAction } from "@/app/learning-actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Note } from "@/components/ui/field";
import { UploadProgress, useUpload } from "@/components/ui/file-upload";
import { Input, Textarea } from "@/components/ui/input";
import { fileSize, uploadError } from "@/lib/upload";

type Mode = "upload" | "link";

/**
 * Pengumpulan tugas: unggah berkas ke penyimpanan privat, atau serahkan
 * tautan.
 *
 * Keduanya disediakan dengan sengaja. Tidak setiap kantor mengizinkan berkas
 * kerjanya berpindah tempat, dan tidak setiap peserta punya drive yang dapat
 * dibagikan. Ketika penyimpanan belum dikonfigurasi, hanya tautan yang muncul —
 * tombol unggah yang tidak menyimpan apa pun lebih buruk daripada satu cara
 * yang jelas bekerja.
 */
export function AssignmentForm({
  batchId,
  assignmentId,
  link,
  notes,
  submitted,
  uploads,
  accept,
  maxBytes,
}: {
  batchId: string;
  assignmentId: string;
  link: string;
  notes: string;
  submitted: boolean;
  uploads: boolean;
  accept: string;
  maxBytes: number;
}) {
  const router = useRouter();
  const upload = useUpload();
  const [sending, start] = useTransition();
  const [mode, setMode] = useState<Mode>(uploads && !link ? "upload" : "link");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const busy = upload.busy || sending;

  function choose(selected: File | null) {
    setFile(selected);
    setFieldError(
      selected ? uploadError(selected.name, selected.size, maxBytes) : null,
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);

    const form = new FormData(event.currentTarget);
    const payload = new FormData();
    payload.set("notes", String(form.get("notes") ?? ""));

    start(async () => {
      if (mode === "upload") {
        if (!file) return setFieldError("Pilih berkas yang akan dikumpulkan.");
        const invalid = uploadError(file.name, file.size, maxBytes);
        if (invalid) return setFieldError(invalid);

        const signed = await signSubmissionUploadAction(batchId, assignmentId, {
          name: file.name,
          size: file.size,
        });
        if (!signed.upload)
          return setError(signed.error ?? "Unggahan ditolak.");

        try {
          await upload.run(signed.upload.url, file);
        } catch (failed) {
          return setError(
            failed instanceof Error ? failed.message : "Unggahan gagal.",
          );
        }
        payload.set("storageKey", signed.upload.key);
      } else {
        payload.set("link", String(form.get("link") ?? ""));
      }

      const state = await submitAssignmentAction(
        batchId,
        assignmentId,
        {},
        payload,
      );
      if (state.error) {
        setError(state.error);
        setFieldError(state.fields?.link?.[0] ?? null);
        return;
      }
      toast.success(state.success!);
      setFile(null);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {uploads ? (
        <div
          role="radiogroup"
          aria-label="Cara pengumpulan"
          className="flex gap-2"
        >
          {(
            [
              ["upload", "Unggah berkas"],
              ["link", "Kirim tautan"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              variant={mode === value ? "primary" : "secondary"}
              size="sm"
              disabled={busy}
              onClick={() => {
                setMode(value);
                setError(null);
                setFieldError(null);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      ) : null}

      {mode === "upload" ? (
        <Field
          label="Berkas tugas"
          htmlFor="file"
          required
          error={fieldError}
          hint={`Maksimum ${fileSize(maxBytes)}. Berkas hanya dapat dibuka oleh Anda dan trainer kelas ini.`}
        >
          <Input
            id="file"
            name="file"
            type="file"
            accept={accept}
            disabled={busy}
            className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:text-ink-700"
            onChange={(event) => choose(event.currentTarget.files?.[0] ?? null)}
          />
        </Field>
      ) : (
        <Field
          label="Tautan berkas tugas"
          htmlFor="link"
          required
          hint="Gunakan tautan Google Drive, OneDrive, atau SharePoint perusahaan Anda. Pastikan trainer memiliki akses baca."
          error={fieldError}
        >
          <Input
            id="link"
            name="link"
            type="url"
            defaultValue={link}
            placeholder="https://"
            disabled={busy}
            aria-invalid={Boolean(fieldError)}
          />
        </Field>
      )}

      <Field label="Catatan untuk trainer" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={notes}
          disabled={busy}
        />
      </Field>

      <UploadProgress progress={upload.progress} file={file} />
      {error ? <FormError>{error}</FormError> : null}
      {!uploads ? (
        <Note>
          Unggahan berkas belum tersedia pada lingkungan ini. Bagikan tugas Anda
          sebagai tautan yang dapat dibuka trainer.
        </Note>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {upload.busy
            ? "Mengunggah…"
            : sending
              ? "Mengirim…"
              : submitted
                ? "Perbarui pengumpulan"
                : "Kumpulkan tugas"}
        </Button>
      </div>
    </form>
  );
}
