"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { startAttemptAction } from "@/app/learning-actions";
import { Button } from "@/components/ui/button";

export function StartAttempt({
  batchId,
  assessmentId,
  label,
  disabled,
}: {
  batchId: string;
  assessmentId: string;
  label: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          // Aksi ini mengalihkan halaman ketika berhasil; nilai kembali hanya
          // muncul jika ada yang menghalangi, misalnya batas percobaan.
          const result = await startAttemptAction(batchId, assessmentId);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      {pending ? "Menyiapkan…" : label}
    </Button>
  );
}
