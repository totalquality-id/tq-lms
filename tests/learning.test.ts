import assert from "node:assert/strict";
import { test } from "node:test";

import { calendarDate, calendarKey, daysBetween } from "@/lib/utils";
import { questionSchema, parseOptions } from "@/schemas/assessment";
import { toCsv } from "@/lib/csv";
import { checkEligibility, type EligibilityInput } from "@/lib/eligibility";
import { gradeAnswer, type SnapshotQuestion } from "@/lib/grading";
import {
  attendanceRate,
  buildProgress,
  type ProgressInput,
} from "@/lib/progress";

/* -------------------------------------------------------------------------
   Tanggal kalender

   Kolom `@db.Date` menyimpan hari tanpa zona waktu. Bug yang pernah terjadi:
   menulis tengah malam Jakarta membuat presensi tercatat pada hari sebelumnya.
   ------------------------------------------------------------------------- */

test("calendar dates round-trip without shifting a day", () => {
  assert.equal(calendarKey(calendarDate("2026-07-01")), "2026-07-01");
  assert.equal(calendarKey(calendarDate("2026-01-01")), "2026-01-01");
  assert.equal(calendarKey(calendarDate("2026-12-31")), "2026-12-31");
});

test("training days cover the full schedule inclusively", () => {
  const days = daysBetween(
    new Date("2026-07-01T02:00:00Z"),
    new Date("2026-07-03T09:00:00Z"),
  );
  assert.deepEqual(days.map(calendarKey), [
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
  ]);
});

/* -------------------------------------------------------------------------
   Kehadiran
   ------------------------------------------------------------------------- */

test("excused days count neither for nor against attendance", () => {
  assert.equal(
    attendanceRate([{ status: "PRESENT" }, { status: "PRESENT" }], 2),
    100,
  );
  assert.equal(
    attendanceRate([{ status: "PRESENT" }, { status: "ABSENT" }], 2),
    50,
  );
  // Satu hari izin mengecilkan penyebut, bukan menurunkan persentase.
  assert.equal(
    attendanceRate([{ status: "PRESENT" }, { status: "EXCUSED" }], 2),
    100,
  );
  assert.equal(attendanceRate([], 3), 0);
});

/* -------------------------------------------------------------------------
   Penilaian otomatis
   ------------------------------------------------------------------------- */

function question(overrides: Partial<SnapshotQuestion>): SnapshotQuestion {
  return {
    id: "q1",
    type: "SINGLE_CHOICE",
    text: "Pertanyaan",
    points: 2,
    explanation: null,
    correctText: null,
    options: [
      { id: "a", text: "Benar", correct: true },
      { id: "b", text: "Salah", correct: false },
    ],
    ...overrides,
  };
}

test("single choice awards points only for the correct option", () => {
  const item = question({});
  assert.equal(gradeAnswer(item, "a"), 2);
  assert.equal(gradeAnswer(item, "b"), 0);
  assert.equal(gradeAnswer(item, ["a", "b"]), 0);
  assert.equal(gradeAnswer(item, undefined), 0);
});

test("multiple choice is graded whole, so selecting everything never pays", () => {
  const item = question({
    type: "MULTIPLE_CHOICE",
    options: [
      { id: "a", text: "A", correct: true },
      { id: "b", text: "B", correct: true },
      { id: "c", text: "C", correct: false },
    ],
  });
  assert.equal(gradeAnswer(item, ["a", "b"]), 2);
  assert.equal(gradeAnswer(item, ["b", "a"]), 2);
  assert.equal(gradeAnswer(item, ["a"]), 0);
  assert.equal(gradeAnswer(item, ["a", "b", "c"]), 0);
});

test("short answers ignore case, spacing, and accept alternatives", () => {
  const item = question({
    type: "SHORT_TEXT",
    options: [],
    correctText: "Statement of Applicability|SoA",
  });
  assert.equal(gradeAnswer(item, "  statement   of applicability "), 2);
  assert.equal(gradeAnswer(item, "SOA"), 2);
  assert.equal(gradeAnswer(item, "Risk register"), 0);
});

test("essays are left for a human to grade", () => {
  assert.equal(gradeAnswer(question({ type: "ESSAY", options: [] }), "…"), null);
});

/* -------------------------------------------------------------------------
   Kemajuan belajar
   ------------------------------------------------------------------------- */

type ProgressFixture = {
  sequential?: boolean;
  completedLessons?: string[];
  attempts?: { assessmentId: string; submittedAt: Date | null; score: number | null }[];
};

function enrollment(fixture: ProgressFixture = {}): ProgressInput {
  const done = new Set(fixture.completedLessons ?? []);
  return {
    id: "e1",
    lessons: [...done].map((lessonId) => ({ lessonId })),
    attempts: fixture.attempts ?? [],
    submissions: [],
    evaluations: [],
    batch: {
      id: "b1",
      status: "ONGOING",
      course: {
        sequential: fixture.sequential ?? false,
        modules: [
          {
            id: "m1",
            title: "Modul 1",
            lessons: [
              { id: "l1", title: "Pelajaran 1", required: true },
              { id: "l2", title: "Pelajaran 2", required: false },
            ],
          },
        ],
      },
      assessments: [
        {
          id: "pre",
          type: "PRE_TEST",
          title: "Pre-Test",
          passingGrade: 0,
        },
        {
          id: "final",
          type: "FINAL_EXAM",
          title: "Ujian akhir",
          passingGrade: 70,
        },
      ],
      assignments: [],
      resources: [],
      evaluation: null,
    },
  } as unknown as ProgressInput;
}

test("only required activities count towards the percentage", () => {
  const progress = buildProgress(enrollment());
  // Wajib: satu pelajaran dan ujian akhir. Pre-test dan pelajaran opsional
  // membantu belajar tetapi tidak menahan kelulusan.
  assert.equal(progress.requiredTotal, 2);
  assert.equal(progress.requiredDone, 0);
  assert.equal(progress.percent, 0);
  assert.equal(progress.lessonsTotal, 2);
});

test("the final exam counts as done only once it is passed", () => {
  const failed = buildProgress(
    enrollment({
      completedLessons: ["l1", "l2"],
      attempts: [
        { assessmentId: "final", submittedAt: new Date(), score: 65 },
      ],
    }),
  );
  assert.equal(failed.requiredDone, 1);

  const passed = buildProgress(
    enrollment({
      completedLessons: ["l1", "l2"],
      attempts: [
        { assessmentId: "final", submittedAt: new Date(), score: 65 },
        { assessmentId: "final", submittedAt: new Date(), score: 84 },
      ],
    }),
  );
  assert.equal(passed.requiredDone, 2);
  assert.equal(passed.percent, 100);
  // Syarat kelulusan sudah lengkap, tetapi pre-test yang belum pernah dibuka
  // tetap ditawarkan sebagai langkah berikutnya: opsional bukan berarti
  // disembunyikan.
  assert.equal(passed.next?.id, "pre");
  assert.equal(passed.next?.required, false);

  const everything = buildProgress(
    enrollment({
      completedLessons: ["l1", "l2"],
      attempts: [
        { assessmentId: "pre", submittedAt: new Date(), score: 60 },
        { assessmentId: "final", submittedAt: new Date(), score: 84 },
      ],
    }),
  );
  assert.equal(everything.next, null);
});

test("sequential courses lock everything after the first unfinished requirement", () => {
  const progress = buildProgress(enrollment({ sequential: true }));
  const byId = new Map(progress.activities.map((a) => [a.id, a]));
  // Pre-test bukan aktivitas wajib, jadi tidak mengunci apa pun sesudahnya.
  assert.equal(byId.get("pre")?.locked, false);
  assert.equal(byId.get("l1")?.locked, false);
  assert.equal(byId.get("l2")?.locked, true);
  assert.equal(byId.get("final")?.locked, true);
  assert.equal(progress.next?.id, "pre");
});

test("nothing is locked when the course allows free navigation", () => {
  const progress = buildProgress(enrollment({ sequential: false }));
  assert.ok(progress.activities.every((activity) => !activity.locked));
});

/* -------------------------------------------------------------------------
   Kelayakan sertifikat
   ------------------------------------------------------------------------- */

function eligibility(overrides: {
  attendance?: { status: string }[];
  finalScore?: number | null;
  withExam?: boolean;
}): EligibilityInput {
  const withExam = overrides.withExam ?? true;
  return {
    attendance: (overrides.attendance ?? []).map((record) => ({
      status: record.status,
    })),
    attempts:
      overrides.finalScore === undefined || overrides.finalScore === null
        ? []
        : [
            {
              assessmentId: "final",
              submittedAt: new Date(),
              score: overrides.finalScore,
            },
          ],
    submissions: [],
    evaluations: [],
    certificate: null,
    batch: {
      startDate: new Date("2026-07-01T02:00:00Z"),
      endDate: new Date("2026-07-03T09:00:00Z"),
      minimumAttendance: 80,
      passingGrade: null,
      assessments: withExam
        ? [{ id: "final", type: "FINAL_EXAM", passingGrade: 70 }]
        : [],
      assignments: [],
      evaluation: null,
    },
  } as unknown as EligibilityInput;
}

const present = [
  { status: "PRESENT" },
  { status: "PRESENT" },
  { status: "PRESENT" },
];

test("a certificate needs both attendance and a passing exam", () => {
  assert.equal(
    checkEligibility(eligibility({ attendance: present, finalScore: 91 }))
      .eligible,
    true,
  );
  assert.equal(
    checkEligibility(eligibility({ attendance: present, finalScore: 62 }))
      .eligible,
    false,
  );
  assert.equal(
    checkEligibility(eligibility({ attendance: [], finalScore: 91 })).eligible,
    false,
  );
});

test("requirements that do not apply to a training are reported as met", () => {
  const { eligible, requirements } = checkEligibility(
    eligibility({ attendance: present, withExam: false }),
  );
  assert.equal(eligible, true);
  const exam = requirements.find((item) => item.label === "Ujian akhir");
  assert.equal(exam?.met, true);
  assert.match(exam?.detail ?? "", /Tidak ada ujian akhir/);
});

test("every unmet requirement is named, not just counted", () => {
  const { requirements } = checkEligibility(
    eligibility({ attendance: [], finalScore: 40 }),
  );
  const unmet = requirements.filter((item) => !item.met).map((i) => i.label);
  assert.deepEqual(unmet, ["Kehadiran", "Ujian akhir"]);
});

/* -------------------------------------------------------------------------
   Bank soal dan ekspor
   ------------------------------------------------------------------------- */

test("choice questions must have options and exactly one marked key", () => {
  const base = {
    courseId: "c1",
    topic: "Klausul 4",
    difficulty: "MEDIUM",
    type: "SINGLE_CHOICE",
    text: "Pertanyaan contoh yang cukup panjang",
    points: 1,
  };
  assert.equal(
    questionSchema.safeParse({ ...base, options: "*Benar\nSalah" }).success,
    true,
  );
  // Tanpa penanda jawaban benar, soal tidak dapat dinilai otomatis.
  assert.equal(
    questionSchema.safeParse({ ...base, options: "Benar\nSalah" }).success,
    false,
  );
  // Dua kunci pada soal pilihan tunggal adalah kekeliruan penyusunan.
  assert.equal(
    questionSchema.safeParse({ ...base, options: "*Benar\n*Salah" }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({ ...base, options: "*Benar" }).success,
    false,
  );
});

test("short answer questions require a key", () => {
  const base = {
    courseId: "c1",
    topic: "Klausul 6",
    difficulty: "HARD",
    type: "SHORT_TEXT",
    text: "Dokumen yang mencantumkan kontrol yang diterapkan disebut",
    points: 1,
  };
  assert.equal(questionSchema.safeParse(base).success, false);
  assert.equal(
    questionSchema.safeParse({ ...base, correctText: "SoA" }).success,
    true,
  );
});

test("option lines keep their order and strip the key marker", () => {
  assert.deepEqual(parseOptions("*Satu\n Dua \n\nTiga"), [
    { correct: true, text: "Satu" },
    { correct: false, text: "Dua" },
    { correct: false, text: "Tiga" },
  ]);
});

test("CSV quotes separators and doubles embedded quotes", () => {
  const csv = toCsv({
    title: "Contoh",
    columns: ["Training", "Catatan"],
    rows: [["ISO 27001", 'Kelas "A"; sesi pagi']],
  });
  assert.ok(csv.startsWith("﻿"), "harus diawali BOM agar rapi di Excel");
  assert.match(csv, /Training;Catatan/);
  assert.match(csv, /"Kelas ""A""; sesi pagi"/);
});
