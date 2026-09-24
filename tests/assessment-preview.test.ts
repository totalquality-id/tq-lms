import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentQuestions } from "../src/features/learning/assessment-questions";
import { visibleQuestions, type SnapshotQuestion } from "../src/lib/grading";

test("participant and preview question controls cover every answer type without answer keys", () => {
  const types = [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
    "SHORT_TEXT",
    "ESSAY",
  ] as const;
  const snapshot: SnapshotQuestion[] = types.map((type) => ({
    id: type,
    type,
    text: `Pertanyaan ${type}`,
    points: 2,
    correctText: "secret-answer",
    explanation: "secret-explanation",
    options:
      type === "SHORT_TEXT" || type === "ESSAY"
        ? []
        : [
            { id: `${type}-a`, text: "Pilihan A", correct: true },
            { id: `${type}-b`, text: "Pilihan B", correct: false },
          ],
  }));
  const questions = visibleQuestions(snapshot);
  const html = renderToStaticMarkup(
    createElement(AssessmentQuestions, { questions }),
  );
  assert.equal((html.match(/type="radio"/g) ?? []).length, 4);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2);
  assert.match(html, /<input[^>]*name="q:SHORT_TEXT"/);
  assert.match(html, /<textarea[^>]*name="q:ESSAY"/);
  for (const type of types) {
    assert.ok(html.includes(`id="question-${type}"`));
    assert.ok(html.includes(`aria-labelledby="question-${type}"`));
  }
  assert.doesNotMatch(
    JSON.stringify(questions),
    /secret-answer|secret-explanation|"correct"/,
  );
  assert.doesNotMatch(html, /secret-answer|secret-explanation/);
});
