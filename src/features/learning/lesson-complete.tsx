"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { lessonAction } from "@/app/learning-actions";
import { Button } from "@/components/ui/button";

export function LessonComplete({
  batchId,
  lessonId,
  done,
  nextHref,
}: {
  batchId: string;
  lessonId: string;
  done: boolean;
  nextHref?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(value: boolean) {
    start(async () => {
      const result = await lessonAction(batchId, lessonId, value);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      router.refresh();
      // Berpindah ke pelajaran berikutnya hanya ketika peserta baru saja
      // menyelesaikan satu pelajaran, bukan ketika membatalkan tandanya.
      if (value && nextHref) router.push(nextHref);
    });
  }

  if (done)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-success)]">
          <Check className="size-4" aria-hidden />
          Sudah selesai
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => toggle(false)}
        >
          Batalkan tanda selesai
        </Button>
      </div>
    );

  return (
    <Button type="button" disabled={pending} onClick={() => toggle(true)}>
      {pending ? "Menyimpan…" : "Tandai selesai"}
    </Button>
  );
}
