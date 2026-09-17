"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";

import {
  archiveAction,
  profileAction,
  reorderAction,
  saveAction,
} from "@/app/actions";
import type { Entity } from "@/services/management";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

export type FieldSpec = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
  full?: boolean;
  help?: string;
  min?: number;
  max?: number;
  placeholder?: string;
};

export function EntityForm({
  entity,
  id,
  parentId,
  title,
  description,
  fields,
  buttonLabel,
  variant,
  size = "md",
  icon = false,
}: {
  entity: Entity;
  id?: string;
  parentId?: string;
  title: string;
  description?: string;
  fields: FieldSpec[];
  buttonLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "link";
  size?: "sm" | "md";
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant ?? (id ? "secondary" : "primary")}
        onClick={() => setOpen(true)}
      >
        {icon ? <Plus aria-hidden /> : null}
        {buttonLabel ?? title}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
      >
        {/*
          Dikunci pada keadaan buka sehingga formulir dipasang ulang setiap
          kali dialog dibuka: isian lama dan galat lama tidak terbawa ke
          pekerjaan berikutnya.
        */}
        <FormContent
          key={String(open)}
          entity={entity}
          id={id}
          parentId={parentId}
          fields={fields}
          close={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

export function FormFields({
  fields,
  errors,
}: {
  fields: FieldSpec[];
  errors?: Record<string, string[]>;
}) {
  const prefix = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const id = `${prefix}-${field.name}`;
        const error = errors?.[field.name]?.[0] ?? null;
        const shared = {
          id,
          name: field.name,
          required: field.required,
          "aria-invalid": Boolean(error),
        };
        return (
          <Field
            key={field.name}
            label={field.label}
            htmlFor={id}
            required={field.required}
            hint={field.help}
            error={error}
            className={field.full ? "sm:col-span-2" : undefined}
          >
            {field.type === "textarea" ? (
              <Textarea
                {...shared}
                defaultValue={field.defaultValue}
                placeholder={field.placeholder}
              />
            ) : field.options ? (
              <Select {...shared} defaultValue={field.defaultValue ?? ""}>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                {...shared}
                type={field.type ?? "text"}
                defaultValue={field.defaultValue}
                min={field.min}
                max={field.max}
                placeholder={field.placeholder}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

function FormContent({
  entity,
  id,
  parentId,
  fields,
  close,
}: {
  entity: Entity;
  id?: string;
  parentId?: string;
  fields: FieldSpec[];
  close: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    saveAction.bind(null, entity, id, parentId),
    {},
  );

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    close();
    if (state.redirectTo) router.push(state.redirectTo);
    else router.refresh();
  }, [state, close, router]);

  return (
    <form action={action} className="space-y-4">
      <FormFields fields={fields} errors={state.fields} />
      {state.error ? <FormError>{state.error}</FormError> : null}
      <div className="flex justify-end gap-2 border-t border-ink-200 pt-4">
        <Button type="button" variant="secondary" onClick={close}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

export function ArchiveButton({
  entity,
  id,
  label = "Arsipkan",
  description = "Riwayat yang sudah tersimpan tetap dipertahankan.",
  variant = "link",
}: {
  entity: Entity;
  id: string;
  label?: string;
  description?: string;
  variant?: "link" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`${label} data ini?`}
        description={description}
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await archiveAction(entity, id);
                if (result.error) toast.error(result.error);
                else {
                  toast.success(result.success);
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Memproses…" : label}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function ReorderButtons({
  entity,
  id,
  first,
  last,
}: {
  entity: "module" | "lesson";
  id: string;
  first: boolean;
  last: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function move(direction: number) {
    start(async () => {
      const result = await reorderAction(entity, id, direction);
      if (result.error) toast.error(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending || first}
        aria-label="Pindahkan ke atas"
        onClick={() => move(-1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending || last}
        aria-label="Pindahkan ke bawah"
        onClick={() => move(1)}
      >
        <ArrowDown aria-hidden />
      </Button>
    </div>
  );
}

export function ProfileForm({
  name,
  jobTitle,
}: {
  name: string;
  jobTitle: string;
}) {
  const [state, action, pending] = useActionState(profileAction, {});

  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  return (
    <form className="space-y-4" action={action}>
      <FormFields
        fields={[
          {
            name: "name",
            label: "Nama lengkap",
            defaultValue: name,
            required: true,
          },
          { name: "jobTitle", label: "Jabatan", defaultValue: jobTitle },
        ]}
        errors={state.fields}
      />
      {state.error ? <FormError>{state.error}</FormError> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan profil"}
        </Button>
      </div>
    </form>
  );
}
