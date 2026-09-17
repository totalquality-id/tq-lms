import type { Metadata } from "next";

import { archiveQuestionAction, questionAction } from "@/app/staff-actions";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { questionFields } from "@/features/management/staff-fields";
import { db } from "@/lib/db";
import { labels } from "@/lib/utils";
import { DIFFICULTIES } from "@/schemas/assessment";
import { requireAdmin } from "@/services/access";
import { questionWhere } from "@/services/question-bank";

export const metadata: Metadata = { title: "Bank soal" };

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    courseId?: string;
    type?: string;
    difficulty?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const page = getPage(filters.page);
  const where = questionWhere(filters);

  const [questions, total, courses] = await Promise.all([
    db.question.findMany({
      where,
      include: {
        course: { select: { title: true } },
        options: { orderBy: { position: "asc" } },
        _count: { select: { assessments: true } },
      },
      orderBy: [{ courseId: "asc" }, { topic: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.question.count({ where }),
    db.course.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Bank soal"
        description="Soal dipakai ulang oleh penilaian di berbagai training pada course yang sama."
        action={
          <DialogForm
            action={questionAction.bind(null, undefined)}
            title="Tambah soal"
            fields={questionFields(courses)}
            icon
          />
        }
      />
      <Card>
        <FilterBar
          q={filters.q}
          placeholder="Cari pertanyaan atau topik…"
          filters={[
            {
              name: "courseId",
              value: filters.courseId,
              label: "Filter course",
              anyLabel: "Semua course",
              options: courses.map((course) => ({
                value: course.id,
                label: course.title,
              })),
            },
            {
              name: "type",
              value: filters.type,
              label: "Filter jenis soal",
              anyLabel: "Semua jenis",
              options: [
                "SINGLE_CHOICE",
                "MULTIPLE_CHOICE",
                "TRUE_FALSE",
                "SHORT_TEXT",
                "ESSAY",
              ],
            },
            {
              name: "difficulty",
              value: filters.difficulty,
              label: "Filter kesulitan",
              anyLabel: "Semua tingkat",
              options: [...DIFFICULTIES],
            },
          ]}
        />

        {questions.length ? (
          <ul className="divide-y divide-ink-100">
            {questions.map((question) => (
              <li key={question.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-ink-900">
                      {question.text}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="info">
                        {labels[question.type] ?? question.type}
                      </Badge>
                      <Badge tone="neutral">
                        {labels[question.difficulty] ?? question.difficulty}
                      </Badge>
                      <span className="text-xs text-ink-500">
                        {question.course.title} · {question.topic} ·{" "}
                        {question.points} poin
                        {question._count.assessments
                          ? ` · dipakai ${question._count.assessments} penilaian`
                          : ""}
                      </span>
                    </div>
                    {question.options.length ? (
                      <ul className="mt-2 space-y-0.5">
                        {question.options.map((option) => (
                          <li
                            key={option.id}
                            className={
                              option.correct
                                ? "text-xs font-medium text-[var(--color-success)]"
                                : "text-xs text-ink-500"
                            }
                          >
                            {option.correct ? "✓ " : "· "}
                            {option.text}
                          </li>
                        ))}
                      </ul>
                    ) : question.correctText ? (
                      <p className="mt-2 text-xs text-[var(--color-success)]">
                        ✓ {question.correctText}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <DialogForm
                      action={questionAction.bind(null, question.id)}
                      title="Edit soal"
                      fields={questionFields(courses, question)}
                      trigger="Edit"
                      triggerVariant="secondary"
                      triggerSize="sm"
                    />
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      action={archiveQuestionAction.bind(null, question.id)}
                      confirm={{
                        title: "Arsipkan soal?",
                        description:
                          "Soal tidak lagi dipilih untuk percobaan baru. Percobaan yang sudah berjalan tidak berubah karena menyimpan salinan soalnya sendiri.",
                      }}
                      confirmLabel="Arsipkan"
                    >
                      Arsipkan
                    </ActionButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Belum ada soal"
            description="Tambahkan soal untuk course agar penilaian dapat mengambilnya."
          />
        )}

        <Pagination
          total={total}
          page={page}
          params={{
            q: filters.q,
            courseId: filters.courseId,
            type: filters.type,
            difficulty: filters.difficulty,
          }}
        />
        <CardBody className="border-t border-ink-200">
          <p className="text-xs leading-relaxed text-ink-500">
            Penilaian mengambil soal dari bank course yang bersangkutan saat
            percobaan dimulai, lalu membekukan salinannya. Menyunting soal tidak
            mengubah nilai yang sudah tercatat.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
