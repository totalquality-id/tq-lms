"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitEvaluationAction } from "@/app/learning-actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import type { EvaluationQuestion } from "@/services/operations";

const SCALE = [1, 2, 3, 4, 5];
const SCALE_LABEL: Record<number, string> = {
  1: "Sangat kurang",
  2: "Kurang",
  3: "Cukup",
  4: "Baik",
  5: "Sangat baik",
};

/**
 * Skala dipasang sebagai kelompok radio, bukan bintang: angkanya terbaca
 * langsung, dapat dicapai dengan keyboard, dan artinya tertulis di bawah
 * setiap pilihan sehingga tidak perlu ditebak.
 */
export function EvaluationForm({
  batchId,
  questions,
  preview = false,
}: {
  batchId: string;
  questions: EvaluationQuestion[];
  preview?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    submitEvaluationAction.bind(null, batchId),
    {},
  );

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    router.refresh();
  }, [state, router]);

  const categories = [...new Set(questions.map((item) => item.category))];

  return (
    <form
      action={preview ? undefined : action}
      onSubmit={preview ? (event) => event.preventDefault() : undefined}
      className="space-y-6"
    >
      {categories.map((category) => (
        <fieldset key={category} className="space-y-4">
          <legend className="text-sm font-semibold text-ink-900">
            {category}
          </legend>
          {questions
            .filter((question) => question.category === category)
            .map((question) =>
              question.type === "RATING" ? (
                <div key={question.id} className="space-y-2">
                  <p
                    id={`label-${question.id}`}
                    className="text-sm text-ink-700"
                  >
                    {question.text}
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby={`label-${question.id}`}
                    className="grid grid-cols-5 gap-2"
                  >
                    {SCALE.map((value) => (
                      <label
                        key={value}
                        className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-ink-200 px-2 py-2.5 text-center hover:bg-ink-50 has-checked:border-brand-400 has-checked:bg-brand-50"
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={value}
                          required
                          className="size-4 accent-[var(--color-brand-600)]"
                        />
                        <span className="tabular text-sm font-medium text-ink-900">
                          {value}
                        </span>
                        <span className="text-[11px] leading-tight text-ink-500">
                          {SCALE_LABEL[value]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={question.id} className="space-y-1.5">
                  <label
                    htmlFor={question.id}
                    className="block text-sm text-ink-700"
                  >
                    {question.text}
                  </label>
                  <Textarea id={question.id} name={question.id} rows={4} />
                </div>
              ),
            )}
        </fieldset>
      ))}

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-200 pt-4">
        <p className="mr-auto text-xs text-ink-500">
          {preview
            ? "Jawaban preview tidak disimpan."
            : "Jawaban dikirim satu kali dan dilaporkan sebagai rekap, tanpa nama Anda."}
        </p>
        <Button type="submit" disabled={pending || preview}>
          {pending ? "Mengirim…" : "Kirim evaluasi"}
        </Button>
      </div>
    </form>
  );
}
