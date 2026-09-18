import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyRules,
  parseRules,
  selectQuestions,
  topicCounts,
  type SelectableQuestion,
} from "@/lib/question-selection";
import { selectionRulesSchema } from "@/schemas/assessment";

/** Pengacak identitas: urutan jadi dapat diprediksi, isinya tetap teruji. */
const stable = <T>(items: T[]) => [...items];

const bank: SelectableQuestion[] = [
  { id: "a1", topic: "Klausul 4" },
  { id: "a2", topic: "Klausul 4" },
  { id: "a3", topic: "Klausul 4" },
  { id: "b1", topic: "Klausul 5" },
  { id: "b2", topic: "Klausul 5" },
  { id: "c1", topic: "Annex A" },
];

test("topics are listed with their counts, sorted for a stable form", () => {
  assert.deepEqual(topicCounts(bank), [
    { topic: "Annex A", available: 1 },
    { topic: "Klausul 4", available: 3 },
    { topic: "Klausul 5", available: 2 },
  ]);
});

test("rules take the requested count from each topic", () => {
  const { questions, outcomes } = applyRules(
    [
      { topic: "Klausul 4", count: 2 },
      { topic: "Klausul 5", count: 1 },
    ],
    bank,
    stable,
  );
  assert.deepEqual(
    questions.map((q) => q.id),
    ["a1", "a2", "b1"],
  );
  assert.deepEqual(outcomes, [
    { topic: "Klausul 4", requested: 2, taken: 2 },
    { topic: "Klausul 5", requested: 1, taken: 1 },
  ]);
});

test("a topic with too few questions yields what exists and reports the shortfall", () => {
  // Menolak memulai ujian karena satu topik kurang dua soal merugikan peserta
  // yang sudah duduk di kelas; yang perlu tahu adalah trainer.
  const { questions, outcomes } = applyRules(
    [{ topic: "Annex A", count: 5 }],
    bank,
    stable,
  );
  assert.equal(questions.length, 1);
  assert.deepEqual(outcomes, [{ topic: "Annex A", requested: 5, taken: 1 }]);
});

test("a topic that no longer exists contributes nothing, not a crash", () => {
  const { questions, outcomes } = applyRules(
    [{ topic: "Klausul 9", count: 3 }],
    bank,
    stable,
  );
  assert.equal(questions.length, 0);
  assert.deepEqual(outcomes, [{ topic: "Klausul 9", requested: 3, taken: 0 }]);
});

test("rules with a zero count are skipped entirely", () => {
  const { questions, outcomes } = applyRules(
    [
      { topic: "Klausul 4", count: 0 },
      { topic: "Klausul 5", count: 1 },
    ],
    bank,
    stable,
  );
  assert.deepEqual(
    questions.map((q) => q.id),
    ["b1"],
  );
  assert.equal(outcomes.length, 1);
});

test("MANUAL keeps the trainer's order unless randomising is on", () => {
  const manual = [bank[3], bank[0], bank[5]];
  const kept = selectQuestions(
    { mode: "MANUAL", rules: [], limit: null, randomize: false },
    { manual, bank },
    stable,
  );
  assert.deepEqual(
    kept.questions.map((q) => q.id),
    ["b1", "a1", "c1"],
  );

  // Dengan pengacak identitas hasilnya sama; yang diuji adalah jalurnya
  // memang melewati pengacak, bukan mengabaikannya.
  const shuffled = selectQuestions(
    { mode: "MANUAL", rules: [], limit: null, randomize: true },
    { manual, bank },
    (items) => [...items].reverse(),
  );
  assert.deepEqual(
    shuffled.questions.map((q) => q.id),
    ["c1", "a1", "b1"],
  );
});

test("MANUAL ignores the bank, so archiving other questions changes nothing", () => {
  const result = selectQuestions(
    { mode: "MANUAL", rules: [], limit: null, randomize: false },
    { manual: [bank[0]], bank: [] },
    stable,
  );
  assert.deepEqual(
    result.questions.map((q) => q.id),
    ["a1"],
  );
});

test("ALL applies the question limit, and ignores it when unset", () => {
  const limited = selectQuestions(
    { mode: "ALL", rules: [], limit: 2, randomize: false },
    { manual: [], bank },
    stable,
  );
  assert.equal(limited.questions.length, 2);

  const whole = selectQuestions(
    { mode: "ALL", rules: [], limit: null, randomize: false },
    { manual: [], bank },
    stable,
  );
  assert.equal(whole.questions.length, bank.length);

  // Nol diperlakukan sama dengan tidak diisi, sesuai keterangan formulir.
  const zero = selectQuestions(
    { mode: "ALL", rules: [], limit: 0, randomize: false },
    { manual: [], bank },
    stable,
  );
  assert.equal(zero.questions.length, bank.length);
});

test("RULES ignores the question limit, because the rules set the count", () => {
  const result = selectQuestions(
    {
      mode: "RULES",
      rules: [{ topic: "Klausul 4", count: 3 }],
      limit: 1,
      randomize: false,
    },
    { manual: [], bank },
    stable,
  );
  assert.equal(result.questions.length, 3);
});

test("stored rules are read defensively", () => {
  assert.deepEqual(parseRules([{ topic: "Klausul 4", count: 2 }]), [
    { topic: "Klausul 4", count: 2 },
  ]);
  // Bentuk yang rusak diabaikan baris per baris, bukan meledakkan halaman.
  assert.deepEqual(parseRules(null), []);
  assert.deepEqual(parseRules("bukan array"), []);
  assert.deepEqual(
    parseRules([
      { topic: "", count: 3 },
      { topic: "Klausul 5", count: 0 },
      { topic: "Klausul 5", count: -1 },
      { topic: "Annex A", count: "2" },
      null,
    ]),
    [{ topic: "Annex A", count: 2 }],
  );
});

test("the rules form rejects an all-zero submission", () => {
  const zero = selectionRulesSchema.safeParse({
    topic: ["Klausul 4", "Klausul 5"],
    count: ["0", "0"],
  });
  assert.equal(zero.success, false);

  const ok = selectionRulesSchema.safeParse({
    topic: ["Klausul 4", "Klausul 5"],
    count: ["2", "0"],
  });
  assert.equal(ok.success, true);
  if (ok.success)
    assert.deepEqual(ok.data, [
      { topic: "Klausul 4", count: 2 },
      { topic: "Klausul 5", count: 0 },
    ]);
});

test("the rules form rejects a total beyond the cap", () => {
  const result = selectionRulesSchema.safeParse({
    topic: ["Klausul 4", "Klausul 5"],
    count: ["150", "100"],
  });
  assert.equal(result.success, false);
});

test("a single topic arrives as a string, not an array", () => {
  // Formulir dengan satu baris mengirim nilai tunggal, bukan daftar.
  const result = selectionRulesSchema.safeParse({
    topic: "Klausul 4",
    count: "5",
  });
  assert.equal(result.success, true);
  if (result.success)
    assert.deepEqual(result.data, [{ topic: "Klausul 4", count: 5 }]);
});
