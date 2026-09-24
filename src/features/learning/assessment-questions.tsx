import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { VisibleQuestion } from "@/lib/grading";
import { labels } from "@/lib/utils";

export function AssessmentQuestions({
  questions,
}: {
  questions: VisibleQuestion[];
}) {
  return (
    <>
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
    </>
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
