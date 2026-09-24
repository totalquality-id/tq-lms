export const QUESTION_TYPE_LABELS = {
  SINGLE_CHOICE: "Satu jawaban",
  MULTIPLE_CHOICE: "Beberapa jawaban",
  TRUE_FALSE: "Benar / Salah",
  SHORT_TEXT: "Isian singkat",
  ESSAY: "Esai",
} as const;

export type QuestionKind = keyof typeof QUESTION_TYPE_LABELS;
