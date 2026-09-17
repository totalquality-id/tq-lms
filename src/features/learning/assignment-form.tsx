"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitAssignmentAction } from "@/app/learning-actions";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";

/**
 * Pengumpulan tugas berupa tautan berkas. Unggahan langsung menunggu
 * penyimpanan privat diaktifkan; sampai saat itu tautan ke drive perusahaan
 * adalah cara yang jujur — bukan tombol unggah yang tidak menyimpan apa pun.
 */
export function AssignmentForm({
  batchId,
  assignmentId,
  link,
  notes,
  submitted,
}: {
  batchId: string;
  assignmentId: string;
  link: string;
  notes: string;
  submitted: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    submitAssignmentAction.bind(null, batchId, assignmentId),
    {},
  );

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Tautan berkas tugas"
        htmlFor="link"
        required
        hint="Gunakan tautan Google Drive, OneDrive, atau SharePoint perusahaan Anda. Pastikan trainer memiliki akses baca."
        error={state.fields?.link?.[0]}
      >
        <Input
          id="link"
          name="link"
          type="url"
          defaultValue={link}
          placeholder="https://"
          required
          aria-invalid={Boolean(state.fields?.link)}
        />
      </Field>
      <Field
        label="Catatan untuk trainer"
        htmlFor="notes"
        error={state.fields?.notes?.[0]}
      >
        <Textarea id="notes" name="notes" rows={4} defaultValue={notes} />
      </Field>
      {state.error ? <FormError>{state.error}</FormError> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Mengirim…"
            : submitted
              ? "Perbarui pengumpulan"
              : "Kumpulkan tugas"}
        </Button>
      </div>
    </form>
  );
}
