"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "./button";
import { Dialog } from "./dialog";
import type { FormState } from "@/schemas/forms";

/**
 * Tombol untuk aksi server yang tidak memerlukan isian. Hasilnya selalu
 * dilaporkan lewat toast, dan halaman disegarkan setelah berhasil supaya
 * angka di layar tidak tertinggal dari basis data.
 *
 * Aksi yang sulit dibatalkan diberi `confirm`; dialognya menyebut akibat
 * tindakan, bukan sekadar bertanya "Anda yakin?".
 */
export function ActionButton({
  action,
  children,
  confirm,
  confirmLabel = "Lanjutkan",
  pendingLabel = "Memproses…",
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<FormState>;
  children: ReactNode;
  confirm?: { title: string; description: string };
  confirmLabel?: string;
  pendingLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const run = () =>
    start(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      router.refresh();
    });

  if (!confirm)
    return (
      <Button type="button" disabled={pending} onClick={run} {...props}>
        {pending ? pendingLabel : children}
      </Button>
    );

  return (
    <>
      <Button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        {...props}
      >
        {children}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={confirm.title}
        description={confirm.description}
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
            variant={props.variant === "danger" ? "danger" : "primary"}
            disabled={pending}
            onClick={run}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
