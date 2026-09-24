"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { questionAction } from "@/app/staff-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { QUESTION_TYPE_LABELS, type QuestionKind } from "@/lib/question-types";

export type EditableQuestion = {
  id: string;
  topic: string;
  difficulty: string;
  type: QuestionKind;
  text: string;
  points: number;
  explanation: string | null;
  correctText: string | null;
  options: { text: string; correct: boolean }[];
};

type Props = {
  course: { id: string; title: string };
  topics: string[];
  question?: EditableQuestion;
};

export function QuestionEditor(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={props.question ? "secondary" : "primary"}
        size={props.question ? "sm" : "md"}
        onClick={() => setOpen(true)}
      >
        {props.question ? <Pencil aria-hidden /> : <Plus aria-hidden />}
        {props.question ? "Edit soal" : "Tambah soal"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={props.question ? "Edit soal" : "Tambah soal"}
        description={props.course.title}
      >
        {open ? <QuestionForm {...props} close={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}

function QuestionForm({
  course,
  topics,
  question,
  close,
}: Props & { close: () => void }) {
  const prefix = useId();
  const router = useRouter();
  const [state, action, pending] = useActionState(
    questionAction.bind(null, question?.id),
    {},
  );
  const [kind, setKind] = useState<QuestionKind>(
    question?.type ?? "SINGLE_CHOICE",
  );
  const [text, setText] = useState(question?.text ?? "");
  const [topic, setTopic] = useState(question?.topic ?? "");
  const [difficulty, setDifficulty] = useState(
    question?.difficulty ?? "MEDIUM",
  );
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [correctText, setCorrectText] = useState(question?.correctText ?? "");
  const [choices, setChoices] = useState(
    question?.options.length && question.type !== "TRUE_FALSE"
      ? question.options.map((option, index) => ({
          ...option,
          key: String(index),
        }))
      : [0, 1, 2, 3].map((index) => ({
          key: String(index),
          text: "",
          correct: false,
        })),
  );
  const [binary, setBinary] = useState(
    question?.type === "TRUE_FALSE" && question.options.length === 2
      ? question.options.map((option, index) => ({
          ...option,
          key: String(index),
        }))
      : [
          { key: "true", text: "Benar", correct: false },
          { key: "false", text: "Salah", correct: false },
        ],
  );
  const isChoice = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(
    kind,
  );
  const options = kind === "TRUE_FALSE" ? binary : choices;
  const setOptions = kind === "TRUE_FALSE" ? setBinary : setChoices;
  const id = (name: string) => `${prefix}-${name}`;
  useEffect(() => {
    if (state.success) {
      toast.success(state.success);
      close();
      router.refresh();
    }
  }, [state, close, router]);

  function changeKind(value: QuestionKind) {
    setKind(value);
    if (value === "SINGLE_CHOICE") {
      setChoices((current) => {
        const first = current.findIndex((option) => option.correct);
        return current.map((option, index) => ({
          ...option,
          correct: index === first,
        }));
      });
    }
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="courseId" value={course.id} />
      {isChoice ? (
        <input
          type="hidden"
          name="optionItems"
          value={JSON.stringify(
            options.map(({ text, correct }) => ({ text, correct })),
          )}
        />
      ) : null}
      <fieldset disabled={pending} className="space-y-5">
        <Field label="Pertanyaan" htmlFor={id("text")} required>
          <Textarea
            id={id("text")}
            name="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            required
            minLength={5}
            maxLength={5000}
            placeholder="Tuliskan pertanyaan yang akan dijawab peserta…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Topik"
            htmlFor={id("topic")}
            required
            hint="Pilih topik yang sudah ada atau tulis topik baru."
          >
            <Input
              id={id("topic")}
              name="topic"
              list={id("topics")}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder="Contoh: Konteks organisasi"
            />
            <datalist id={id("topics")}>
              {topics.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
          <Field label="Jenis jawaban" htmlFor={id("type")}>
            <Select
              id={id("type")}
              name="type"
              value={kind}
              onChange={(event) =>
                changeKind(event.target.value as QuestionKind)
              }
            >
              {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {isChoice ? (
          <fieldset className="space-y-3 rounded-lg border border-ink-200 bg-ink-25 p-4">
            <legend className="px-1 text-sm font-semibold text-ink-900">
              Pilihan & kunci jawaban
            </legend>
            <p className="text-xs text-ink-600">
              {kind === "MULTIPLE_CHOICE"
                ? "Centang semua jawaban yang benar. Peserta dapat memilih lebih dari satu."
                : "Pilih satu jawaban yang benar dengan menekan lingkaran di sebelahnya."}
            </p>
            {options.map((option, index) => (
              <div
                key={option.key}
                className={`flex items-start gap-2 rounded-md border p-2 ${option.correct ? "border-brand-300 bg-brand-50" : "border-ink-200 bg-white"}`}
              >
                <label className="flex h-10 shrink-0 cursor-pointer items-center gap-2 px-1 text-sm font-semibold text-ink-700">
                  <input
                    type={kind === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                    name={
                      kind === "MULTIPLE_CHOICE" ? undefined : `${prefix}-key`
                    }
                    checked={option.correct}
                    aria-label={`Jawaban ${String.fromCharCode(65 + index)} benar`}
                    className="size-4 accent-brand-600"
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, position) => ({
                          ...item,
                          correct:
                            position === index
                              ? event.target.checked
                              : kind === "MULTIPLE_CHOICE" && item.correct,
                        })),
                      )
                    }
                  />
                  {String.fromCharCode(65 + index)}
                </label>
                <div className="min-w-0 flex-1">
                  <Input
                    aria-label={`Pilihan ${String.fromCharCode(65 + index)}`}
                    value={option.text}
                    readOnly={kind === "TRUE_FALSE"}
                    required
                    maxLength={500}
                    placeholder={`Tulis pilihan ${String.fromCharCode(65 + index)}`}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  {option.correct ? (
                    <p className="mt-1 text-xs font-medium text-brand-700">
                      Kunci jawaban
                    </p>
                  ) : null}
                </div>
                {kind !== "TRUE_FALSE" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={options.length <= 2}
                    aria-label={`Hapus pilihan ${String.fromCharCode(65 + index)}`}
                    onClick={() =>
                      setChoices((current) =>
                        current.filter((item) => item.key !== option.key),
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
            {kind !== "TRUE_FALSE" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={choices.length >= 20}
                onClick={() =>
                  setChoices((current) => [
                    ...current,
                    { key: crypto.randomUUID(), text: "", correct: false },
                  ])
                }
              >
                <Plus aria-hidden />
                Tambah pilihan
              </Button>
            ) : null}
          </fieldset>
        ) : kind === "SHORT_TEXT" ? (
          <Field
            label="Jawaban yang diterima"
            htmlFor={id("correctText")}
            required
            hint="Untuk beberapa variasi jawaban, pisahkan dengan |. Contoh: PDCA | Plan Do Check Act."
          >
            <Input
              id={id("correctText")}
              name="correctText"
              value={correctText}
              onChange={(event) => setCorrectText(event.target.value)}
              required
              maxLength={500}
            />
          </Field>
        ) : (
          <p className="rounded-lg bg-brand-50 p-4 text-sm text-ink-700">
            Peserta menulis jawaban panjang. Trainer memeriksa dan memberi nilai
            secara manual.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tingkat kesulitan" htmlFor={id("difficulty")}>
            <Select
              id={id("difficulty")}
              name="difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
            >
              <option value="EASY">Mudah</option>
              <option value="MEDIUM">Sedang</option>
              <option value="HARD">Sulit</option>
            </Select>
          </Field>
          <Field label="Poin jawaban benar" htmlFor={id("points")}>
            <Input
              id={id("points")}
              name="points"
              type="number"
              min={1}
              max={100}
              required
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Pembahasan (opsional)"
          htmlFor={id("explanation")}
          hint="Jelaskan alasan jawaban benar atau pedoman penilaian esai."
        >
          <Textarea
            id={id("explanation")}
            name="explanation"
            value={explanation}
            maxLength={2000}
            onChange={(event) => setExplanation(event.target.value)}
          />
        </Field>
      </fieldset>
      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.fields ? (
        <FormError>
          {[...new Set(Object.values(state.fields).flat())].join(" ")}
        </FormError>
      ) : null}
      <div className="sticky -bottom-4 flex justify-end gap-2 border-t border-ink-200 bg-white py-4">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={close}
        >
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan soal"}
        </Button>
      </div>
    </form>
  );
}
