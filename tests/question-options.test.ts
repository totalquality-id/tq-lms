import assert from "node:assert/strict";
import test from "node:test";
import { questionSchema } from "../src/schemas/assessment";

const base = {
  courseId: "course-test",
  topic: "Prinsip mutu",
  difficulty: "MEDIUM",
  type: "SINGLE_CHOICE",
  text: "Manakah jawaban yang benar?",
  points: 1,
};
const choices = [
  { text: "* adalah tanda perkalian", correct: false },
  { text: "Jawaban yang benar", correct: true },
];

test("visual choices preserve literal stars and the selected answer", () => {
  const result = questionSchema.parse({
    ...base,
    optionItems: JSON.stringify(choices),
  });
  assert.deepEqual(result.optionItems, choices);
});

test("visual choices reject no key, multiple single-choice keys, and blank options", () => {
  for (const options of [
    choices.map((option) => ({ ...option, correct: false })),
    choices.map((option) => ({ ...option, correct: true })),
    [{ text: "", correct: false }, choices[1]],
  ]) {
    assert.equal(
      questionSchema.safeParse({
        ...base,
        optionItems: JSON.stringify(options),
      }).success,
      false,
    );
  }
});

test("multiple-answer questions accept multiple keys", () => {
  const options = choices.map((option) => ({ ...option, correct: true }));
  assert.equal(
    questionSchema.safeParse({
      ...base,
      type: "MULTIPLE_CHOICE",
      optionItems: JSON.stringify(options),
    }).success,
    true,
  );
});

test("malformed, oversized, and incomplete visual options fail instead of being truncated", () => {
  for (const value of [
    "not-json",
    "null",
    JSON.stringify([choices[0]]),
    JSON.stringify(Array(21).fill(choices[1])),
    JSON.stringify([{ text: "x".repeat(501), correct: true }, choices[0]]),
  ]) {
    assert.equal(
      questionSchema.safeParse({ ...base, optionItems: value }).success,
      false,
    );
  }
});

test("legacy forms and non-choice questions remain supported", () => {
  assert.equal(
    questionSchema.safeParse({ ...base, options: "Tidak\n*Ya" }).success,
    true,
  );
  assert.equal(
    questionSchema.safeParse({ ...base, type: "ESSAY" }).success,
    true,
  );
  assert.equal(
    questionSchema.safeParse({
      ...base,
      type: "SHORT_TEXT",
      correctText: "PDCA",
    }).success,
    true,
  );
  assert.equal(
    questionSchema.safeParse({ ...base, type: "SHORT_TEXT" }).success,
    false,
  );
});
