"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitAttemptAction } from "@/app/learning-actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import type { VisibleQuestion } from "@/services/assessment";
import { labels } from "@/lib/utils";

function remainingText(ms: number) {
  if (ms <= 0) return "Waktu habis";
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Halaman pengerjaan. Penghitung waktu di sini hanya memberi tahu pembaca
 * berapa sisa waktunya; keputusan diterima atau tidaknya jawaban sepenuhnya
 * diambil server berdasarkan `expiresAt` yang tersimpan pada percobaan.
 * Karena itu penghitung yang dimanipulasi tidak memperpanjang ujian, dan
 * penghitung yang berhenti karena tab tertidur tidak merugikan peserta.
 */
export function AttemptRunner({
  batchId,
  assessmentId,
  attemptId,
  expiresAt,
  questions,
}: {
  batchId: string;
  assessmentId: string;
  attemptId: string;
  expiresAt: string;
  questions: VisibleQuestion[];
}) {
  const router = useRouter();
  const deadline = new Date(expiresAt).getTime();
  const [left, setLeft] = useState(() => deadline - Date.now());
  const form = useRef<HTMLFormElement>(null);
  const autoSubmitted = useRef(false);

  const [state, action, pending] = useActionState(
    submitAttemptAction.bind(null, batchId, assessmentId, attemptId),
    {},
  );

  useEffect(() => {
    const timer = setInterval(() => setLeft(deadline - Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  // Ketika waktu habis, jawaban yang sudah terisi tetap dikirim satu kali
  // supaya tidak ada yang hilang begitu saja. Server yang menentukan apakah
  // pengiriman itu masih dihitung.
  useEffect(() => {
    if (left > 0 || autoSubmitted.current || pending) return;
    autoSubmitted.current = true;
    form.current?.requestSubmit();
  }, [left, pending]);

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [state, router]);

  const urgent = left > 0 && left < 2 * 60 * 1000;

  return (
    <form ref={form} action={action} className="space-y-4">
      <div className="sticky top-14 z-30 -mx-4 border-b border-ink-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-[var(--radius-card)] sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-ink-600">
            {questions.length} soal · jawaban tersimpan saat dikirim
          </span>
          <span
            aria-live="polite"
            className={
              urgent
                ? "tabular text-sm font-semibold text-danger"
                : "tabular text-sm font-semibold text-ink-900"
            }
          >
            Sisa waktu {remainingText(left)}
          </span>
        </div>
      </div>

      {questions.map((question, index) => (
        <Card key={question.id}>
          <CardHeader
            title={`Soal ${index + 1}`}
            description={`${labels[question.type] ?? question.type} · ${question.points} poin`}
          />
          <CardBody className="space-y-3">
            <p
              id={`question-${question.id}`}
              className="text-sm leading-relaxed whitespace-pre-line text-ink-800"
            >
              {question.text}
            </p>
            <QuestionInput question={question} />
          </CardBody>
        </Card>
      ))}

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-xs text-ink-500">
          Periksa kembali jawaban Anda. Pengiriman tidak dapat diulang pada
          percobaan yang sama.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Mengirim…" : "Kirim jawaban"}
        </Button>
      </div>
    </form>
  );
}

function QuestionInput({ question }: { question: VisibleQuestion }) {
  const name = `q:${question.id}`;
  // Kontrol dinamai oleh paragraf pertanyaan yang sudah tampil di atasnya,
  // bukan oleh salinan tersembunyi: pembaca layar mengumumkan pertanyaannya
  // satu kali, bukan dua kali.
  const labelledBy = `question-${question.id}`;

  if (question.type === "ESSAY")
    return (
      <Textarea
        name={name}
        rows={6}
        aria-labelledby={labelledBy}
        placeholder="Tulis jawaban Anda di sini."
      />
    );

  if (question.type === "SHORT_TEXT")
    return (
      <Input
        name={name}
        aria-labelledby={labelledBy}
        placeholder="Jawaban singkat"
      />
    );

  const multiple = question.type === "MULTIPLE_CHOICE";

  return (
    <fieldset className="space-y-2" aria-labelledby={labelledBy}>
      {multiple ? (
        <p className="text-xs text-ink-500">
          Pilih semua jawaban yang benar. Nilai diberikan hanya bila seluruh
          pilihan tepat.
        </p>
      ) : null}
      {question.options.map((option) => (
        <label
          key={option.id}
          className="flex cursor-pointer items-start gap-2.5 rounded-md border border-ink-200 px-3 py-2.5 text-sm text-ink-800 hover:bg-ink-50 has-checked:border-brand-400 has-checked:bg-brand-50"
        >
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={option.id}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-600)]"
          />
          <span>{option.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
