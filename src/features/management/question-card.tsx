"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, ChevronUp, Eye, Archive } from "lucide-react";
import { archiveQuestionAction } from "@/app/staff-actions";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/utils";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";
import { QuestionEditor, type EditableQuestion } from "./question-editor";

export function QuestionCard({
  question,
  course,
  topics,
  number,
}: {
  question: EditableQuestion & { usageCount: number };
  course: { id: string; title: string };
  topics: string[];
  number: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return (
    <article className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span className="font-semibold text-ink-700">SOAL {number}</span>
          <span aria-hidden>·</span>
          <span>{question.topic}</span>
        </div>
        <h2
          className={`break-words text-base font-medium leading-relaxed text-ink-900 ${expanded ? "whitespace-pre-wrap" : "line-clamp-3"}`}
        >
          {question.text}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="info">{QUESTION_TYPE_LABELS[question.type]}</Badge>
          <Badge>{labels[question.difficulty] ?? question.difficulty}</Badge>
          <span className="text-xs text-ink-500">{question.points} poin</span>
          {question.usageCount ? (
            <span className="text-xs text-ink-500">
              · Dipakai di {question.usageCount} penilaian
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 bg-ink-25 px-4 py-3 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded(!expanded)}
        >
          <Eye aria-hidden />
          {expanded ? "Tutup jawaban" : "Lihat jawaban"}
          {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
        <div className="flex flex-wrap gap-2">
          <QuestionEditor course={course} topics={topics} question={question} />
          <ActionButton
            variant="ghost"
            size="sm"
            action={archiveQuestionAction.bind(null, question.id)}
            confirm={{
              title: "Arsipkan soal?",
              description:
                "Soal akan disembunyikan dari bank soal dan tidak dipilih untuk ujian baru. Hasil ujian sebelumnya tetap tersimpan.",
            }}
            confirmLabel="Arsipkan soal"
          >
            <Archive aria-hidden />
            Arsipkan
          </ActionButton>
        </div>
      </div>
      <div
        id={panelId}
        hidden={!expanded}
        className="border-t border-ink-200 p-4 sm:p-5"
      >
        <h3 className="mb-3 text-sm font-semibold text-ink-900">
          {question.options.length ? "Pilihan jawaban" : "Kunci & penilaian"}
        </h3>
        {question.options.length ? (
          <ul className="space-y-2">
            {question.options.map((option, index) => (
              <li
                key={index}
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${option.correct ? "border-brand-200 bg-brand-50 text-ink-900" : "border-ink-200 text-ink-600"}`}
              >
                <span className="font-semibold">
                  {String.fromCharCode(65 + index)}.
                </span>
                <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                  {option.text}
                  {option.correct ? (
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-700">
                      <Check className="size-3" aria-hidden />
                      Jawaban benar
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-brand-50 p-3 text-sm text-ink-700">
            {question.correctText ||
              "Jawaban esai diperiksa dan dinilai oleh trainer."}
          </p>
        )}
        {question.explanation ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink-900">Pembahasan</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">
              {question.explanation}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
