"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { FormFields, type FieldSpec } from "./entity-form";
import type { FormState } from "@/schemas/forms";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/**
 * Dialog berisi formulir untuk aksi server mana pun. Berbeda dari EntityForm
 * yang terikat pada layanan manajemen entitas, komponen ini menerima aksi apa
 * saja — dipakai oleh penilaian, tugas, materi, dan pencabutan sertifikat.
 */
export function DialogForm({
  action,
  title,
  description,
  fields,
  trigger,
  triggerVariant,
  triggerSize = "md",
  icon = false,
  submitLabel = "Simpan",
}: {
  action: Action;
  title: string;
  description?: string;
  fields: FieldSpec[];
  trigger?: string;
  triggerVariant?: "primary" | "secondary" | "ghost" | "link" | "danger";
  triggerSize?: "sm" | "md";
  icon?: boolean;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size={triggerSize}
        variant={triggerVariant ?? "primary"}
        onClick={() => setOpen(true)}
      >
        {icon ? <Plus aria-hidden /> : null}
        {trigger ?? title}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
      >
        {/* Dipasang ulang setiap kali dibuka: isian dan galat lama tidak
            terbawa ke pekerjaan berikutnya. */}
        <Body
          key={String(open)}
          action={action}
          fields={fields}
          submitLabel={submitLabel}
          close={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

function Body({
  action,
  fields,
  submitLabel,
  close,
}: {
  action: Action;
  fields: FieldSpec[];
  submitLabel: string;
  close: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, {});

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    close();
    router.refresh();
  }, [state, close, router]);

  return (
    <form action={formAction} className="space-y-4">
      <FormFields fields={fields} errors={state.fields} />
      {state.error ? <FormError>{state.error}</FormError> : null}
      <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
        <Button type="button" variant="secondary" onClick={close}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
