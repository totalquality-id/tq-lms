"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  assessmentQuestionsAction,
  selectionRulesAction,
} from "@/app/staff-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, Note } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/utils";

export type BankQuestion = {
  id: string;
  topic: string;
  text: string;
  type: string;
  difficulty: string;
  points: number;
};

export type Topic = { topic: string; available: number };

/* -------------------------------------------------------------------------
   Pemilihan manual
   ------------------------------------------------------------------------- */

/**
 * Daftar centang seluruh bank soal course, dikelompokkan per topik.
 *
 * Urutan pengiriman mengikuti urutan pada halaman, dan urutan itulah yang
 * disimpan sebagai urutan soal — jadi apa yang trainer lihat di sini sama
 * dengan apa yang peserta terima, kecuali pengacakan dinyalakan.
 */
export function ManualQuestionPicker({
  batchId,
  assessmentId,
  title,
  bank,
  selected,
}: {
  batchId: string;
  assessmentId: string;
  title: string;
  bank: BankQuestion[];
  selected: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        Pilih soal
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Pilih soal"
        description={`${title} · ${bank.length} soal tersedia di bank course ini.`}
      >
        <PickerBody
          key={String(open)}
          batchId={batchId}
          assessmentId={assessmentId}
          bank={bank}
          selected={selected}
          close={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

function PickerBody({
  batchId,
  assessmentId,
  bank,
  selected,
  close,
}: {
  batchId: string;
  assessmentId: string;
  bank: BankQuestion[];
  selected: string[];
  close: () => void;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));
  const [state, action, pending] = useActionState(
    assessmentQuestionsAction.bind(null, batchId, assessmentId),
    {},
  );

  const grouped = useMemo(() => {
    const map = new Map<string, BankQuestion[]>();
    for (const question of bank) {
      const list = map.get(question.topic);
      if (list) list.push(question);
      else map.set(question.topic, [question]);
    }
    return [...map.entries()];
  }, [bank]);

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    close();
    router.refresh();
  }, [state, close, router]);

  const points = bank
    .filter((question) => chosen.has(question.id))
    .reduce((sum, question) => sum + question.points, 0);

  if (bank.length === 0)
    return (
      <Note>
        Bank soal course ini masih kosong. Tambahkan soal di menu Bank soal
        terlebih dahulu.
      </Note>
    );

  return (
    <form action={action} className="space-y-4">
      <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
        {grouped.map(([topic, questions]) => (
          <fieldset key={topic} className="space-y-1.5">
            <legend className="text-xs font-semibold tracking-wider text-ink-500 uppercase">
              {topic}
            </legend>
            {questions.map((question) => (
              <label
                key={question.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-md border border-ink-200 px-3 py-2.5 text-sm hover:bg-ink-50 has-checked:border-brand-400 has-checked:bg-brand-50"
              >
                <input
                  type="checkbox"
                  name="questionId"
                  value={question.id}
                  defaultChecked={chosen.has(question.id)}
                  onChange={(event) =>
                    setChosen((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(question.id);
                      else next.delete(question.id);
                      return next;
                    })
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand-600)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-ink-800">{question.text}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">
                      {labels[question.type] ?? question.type}
                    </Badge>
                    <span className="text-xs text-ink-500">
                      {labels[question.difficulty] ?? question.difficulty} ·{" "}
                      {question.points} poin
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-200 pt-4">
        <p className="tabular mr-auto text-xs text-ink-500">
          {chosen.size} soal dipilih · total {points} poin
        </p>
        <Button type="button" variant="secondary" onClick={close}>
          Batal
        </Button>
        <Button type="submit" disabled={pending || chosen.size === 0}>
          {pending ? "Menyimpan…" : "Simpan daftar soal"}
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------
   Aturan per topik
   ------------------------------------------------------------------------- */

/**
 * Satu baris per topik yang ada di bank soal, dengan jumlah soal yang diminta.
 *
 * Topiknya sudah diketahui dari bank soal, jadi tidak perlu formulir yang bisa
 * menambah dan menghapus baris sendiri: pertanyaannya cukup "dari topik ini,
 * berapa soal?" dan nol berarti tidak dipakai.
 */
export function SelectionRulesForm({
  batchId,
  assessmentId,
  title,
  topics,
  rules,
}: {
  batchId: string;
  assessmentId: string;
  title: string;
  topics: Topic[];
  rules: { topic: string; count: number }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        Atur aturan
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Aturan soal per topik"
        description={`${title} · soal diacak ulang untuk setiap peserta.`}
      >
        <RulesBody
          key={String(open)}
          batchId={batchId}
          assessmentId={assessmentId}
          topics={topics}
          rules={rules}
          close={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}

function RulesBody({
  batchId,
  assessmentId,
  topics,
  rules,
  close,
}: {
  batchId: string;
  assessmentId: string;
  topics: Topic[];
  rules: { topic: string; count: number }[];
  close: () => void;
}) {
  const router = useRouter();
  const existing = new Map(rules.map((rule) => [rule.topic, rule.count]));
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      topics.map((topic) => [topic.topic, existing.get(topic.topic) ?? 0]),
    ),
  );
  const [state, action, pending] = useActionState(
    selectionRulesAction.bind(null, batchId, assessmentId),
    {},
  );

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    close();
    router.refresh();
  }, [state, close, router]);

  if (topics.length === 0)
    return (
      <Note>
        Bank soal course ini masih kosong, sehingga belum ada topik yang dapat
        diatur. Tambahkan soal di menu Bank soal terlebih dahulu.
      </Note>
    );

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <form action={action} className="space-y-4">
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {topics.map((topic) => (
          <div
            key={topic.topic}
            className="flex flex-wrap items-center gap-3 rounded-md border border-ink-200 px-3 py-2.5"
          >
            <input type="hidden" name="topic" value={topic.topic} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink-800">{topic.topic}</span>
              <span className="tabular block text-xs text-ink-500">
                {topic.available} soal tersedia
              </span>
            </span>
            <Input
              name="count"
              type="number"
              min={0}
              max={topic.available}
              value={counts[topic.topic] ?? 0}
              aria-label={`Jumlah soal dari ${topic.topic}`}
              className="w-20 text-center"
              onChange={(event) =>
                setCounts((current) => ({
                  ...current,
                  [topic.topic]: Math.max(0, Number(event.target.value) || 0),
                }))
              }
            />
          </div>
        ))}
      </div>

      {state.error ? <FormError>{state.error}</FormError> : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-200 pt-4">
        <p className="tabular mr-auto text-xs text-ink-500">
          Total {total} soal per percobaan
        </p>
        <Button type="button" variant="secondary" onClick={close}>
          Batal
        </Button>
        <Button type="submit" disabled={pending || total === 0}>
          {pending ? "Menyimpan…" : "Simpan aturan"}
        </Button>
      </div>
    </form>
  );
}
