"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import {
  signResourceUploadAction,
  uploadedResourceAction,
} from "@/app/file-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { UploadProgress, useUpload } from "@/components/ui/file-upload";
import { Input, Textarea } from "@/components/ui/input";
import { fileSize, uploadError } from "@/lib/upload";

/**
 * Mengunggah satu berkas materi ke penyimpanan privat kelas ini.
 *
 * Berkasnya diperiksa di peramban sebelum tanda tangan diminta — jenis dan
 * ukuran yang jelas-jelas ditolak tidak perlu menempuh perjalanan bolak-balik
 * ke server dulu. Pemeriksaan yang menentukan tetap berlangsung di server;
 * yang di sini hanya menghemat waktu tunggu pengunggah.
 */
export function ResourceUpload({
  batchId,
  accept,
  maxBytes,
}: {
  batchId: string;
  accept: string;
  maxBytes: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <Upload aria-hidden />
        Unggah berkas
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Unggah berkas materi"
        description={`Berkas disimpan pada penyimpanan privat kelas ini. Maksimum ${fileSize(maxBytes)}.`}
      >
        <Body
          key={String(open)}
          batchId={batchId}
          accept={accept}
          maxBytes={maxBytes}
          close={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

function Body({
  batchId,
  accept,
  maxBytes,
  close,
}: {
  batchId: string;
  accept: string;
  maxBytes: number;
  close: () => void;
}) {
  const router = useRouter();
  const upload = useUpload();
  const [saving, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const busy = upload.busy || saving;

  function choose(selected: File | null) {
    setFile(selected);
    setFieldError(
      selected ? uploadError(selected.name, selected.size, maxBytes) : null,
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file) return setFieldError("Pilih berkas yang akan diunggah.");
    const invalid = uploadError(file.name, file.size, maxBytes);
    if (invalid) return setFieldError(invalid);

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim() || file.name;
    const description = String(form.get("description") ?? "").trim();

    start(async () => {
      const signed = await signResourceUploadAction(batchId, {
        name: file.name,
        size: file.size,
      });
      if (!signed.upload) return setError(signed.error ?? "Unggahan ditolak.");

      try {
        await upload.run(signed.upload.url, file);
      } catch (failed) {
        return setError(
          failed instanceof Error ? failed.message : "Unggahan gagal.",
        );
      }

      const saved = await uploadedResourceAction(batchId, {
        title,
        description,
        storageKey: signed.upload.key,
      });
      if (saved.error) return setError(saved.error);

      toast.success(saved.success!);
      close();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Berkas"
        htmlFor="file"
        required
        error={fieldError}
        hint={`Maksimum ${fileSize(maxBytes)}. Berkas hanya dapat dibuka peserta kelas ini melalui tautan berumur pendek.`}
      >
        <Input
          id="file"
          name="file"
          type="file"
          accept={accept}
          required
          disabled={busy}
          className="h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-sm file:text-ink-700"
          onChange={(event) => choose(event.currentTarget.files?.[0] ?? null)}
        />
      </Field>

      <Field
        label="Judul materi"
        htmlFor="title"
        hint="Kosongkan untuk memakai nama berkasnya."
      >
        <Input
          id="title"
          name="title"
          disabled={busy}
          placeholder={file?.name ?? "Nama berkas"}
        />
      </Field>

      <Field label="Keterangan" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          rows={3}
          disabled={busy}
        />
      </Field>

      <UploadProgress progress={upload.progress} file={file} />
      {error ? <FormError>{error}</FormError> : null}

      <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={close}
          disabled={busy}
        >
          Batal
        </Button>
        <Button type="submit" disabled={busy}>
          {upload.busy ? "Mengunggah…" : saving ? "Menyimpan…" : "Unggah"}
        </Button>
      </div>
    </form>
  );
}
