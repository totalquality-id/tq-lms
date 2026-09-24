import Link from "@/components/ui/navigation-link";
import { notFound } from "next/navigation";
import { Search, SlidersHorizontal, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/table";
import { QuestionEditor } from "@/features/management/question-editor";
import { QuestionCard } from "@/features/management/question-card";
import { db } from "@/lib/db";
import { QUESTION_TYPE_LABELS } from "@/lib/question-types";
import { requireAdmin } from "@/services/access";
import { questionWhere } from "@/services/question-bank";

export type QuestionBankFilters = {
  q?: string;
  topic?: string;
  type?: string;
  difficulty?: string;
  page?: string;
};

export async function CourseQuestionBank({ courseId, filters, batchId }: {
  courseId: string;
  filters: QuestionBankFilters;
  batchId?: string;
}) {
  await requireAdmin();
  const course = await db.course.findFirst({
    where: { id: courseId, deletedAt: null, ...(batchId ? { batches: { some: { id: batchId, deletedAt: null } } } : { sourceCourseId: null }) },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  // Batasi enum dari URL sebelum diteruskan ke Prisma.
  const type =
    filters.type && Object.hasOwn(QUESTION_TYPE_LABELS, filters.type)
      ? filters.type
      : undefined;
  const difficulty = ["EASY", "MEDIUM", "HARD"].includes(
    filters.difficulty ?? "",
  )
    ? filters.difficulty
    : undefined;
  const activeFilters = {
    q: filters.q,
    topic: filters.topic,
    type,
    difficulty,
  };
  const where = questionWhere({ ...activeFilters, courseId });
  const [total, topics] = await Promise.all([
    db.question.count({ where }),
    db.question.groupBy({
      by: ["topic"],
      where: { courseId, deletedAt: null },
      _count: { _all: true },
      orderBy: { topic: "asc" },
    }),
  ]);
  const page = Math.min(
    getPage(filters.page),
    Math.max(1, Math.ceil(total / PAGE_SIZE)),
  );
  const questions = await db.question.findMany({
    where,
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { assessments: true } },
    },
    orderBy: [{ topic: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const allTotal = topics.reduce((sum, item) => sum + item._count._all, 0);
  const topicNames = topics.map((item) => item.topic);
  const base = batchId ? `/admin/training/${batchId}/questions` : `/admin/question-bank/${courseId}`;
  const filtered = Boolean(filters.q || filters.topic || type || difficulty);
  const topicHref = (topic?: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...activeFilters, topic }))
      if (value) query.set(key, value);
    return `${base}${query.size ? `?${query}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Kelola soal"
        backHref={batchId ? `/admin/training/${batchId}` : "/admin/question-bank"}
        backLabel={batchId ? "Kembali ke training" : "Bank soal / Semua course"}
        description={batchId ? `${course.title} · Soal khusus training ini; perubahan tidak memengaruhi course induk.` : course.title}
        action={<QuestionEditor course={course} topics={topicNames} />}
      />
      <div className="mb-5 flex items-center gap-2 text-sm text-ink-600">
        <ListChecks className="size-4 text-brand-600" aria-hidden />
        <span>
          <strong className="font-semibold text-ink-900">
            {allTotal} soal
          </strong>{" "}
          dalam {topics.length} topik
        </span>
      </div>

      <div className="mb-5 rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
        <form className="space-y-3">
          {filters.topic ? (
            <input type="hidden" name="topic" value={filters.topic} />
          ) : null}
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="absolute top-3 left-3 size-4 text-ink-400"
                aria-hidden
              />
              <Input
                aria-label="Cari soal"
                name="q"
                defaultValue={filters.q}
                placeholder="Cari pertanyaan atau topik…"
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary">
              Cari
            </Button>
          </div>
          <details open={Boolean(type || difficulty)} className="group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md py-1 text-sm text-ink-600 hover:text-brand-700 focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filter jenis & kesulitan
              {type || difficulty ? (
                <span className="rounded-full bg-brand-50 px-2 text-xs text-brand-700">
                  Aktif
                </span>
              ) : null}
            </summary>
            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3">
              <Field
                label="Jenis jawaban"
                htmlFor="filter-type"
                className="min-w-40 flex-1"
              >
                <Select id="filter-type" name="type" defaultValue={type ?? ""}>
                  <option value="">Semua jenis</option>
                  {Object.entries(QUESTION_TYPE_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field
                label="Tingkat kesulitan"
                htmlFor="filter-difficulty"
                className="min-w-40 flex-1"
              >
                <Select
                  id="filter-difficulty"
                  name="difficulty"
                  defaultValue={difficulty ?? ""}
                >
                  <option value="">Semua tingkat</option>
                  <option value="EASY">Mudah</option>
                  <option value="MEDIUM">Sedang</option>
                  <option value="HARD">Sulit</option>
                </Select>
              </Field>
              <Button type="submit" variant="secondary">
                Terapkan filter
              </Button>
            </div>
          </details>
        </form>
        {topics.length ? (
          <nav
            aria-label="Pilih topik"
            className="mt-4 border-t border-ink-100 pt-4"
          >
            <p className="mb-2 text-xs font-medium text-ink-500">TOPIK</p>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {[
                { topic: undefined, label: "Semua topik", count: allTotal },
                ...topics.map((item) => ({
                  topic: item.topic,
                  label: item.topic,
                  count: item._count._all,
                })),
              ].map((item) => (
                <Link
                  key={item.topic ?? "all"}
                  href={topicHref(item.topic)}
                  aria-current={
                    (filters.topic || undefined) === item.topic
                      ? "page"
                      : undefined
                  }
                  className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${(filters.topic || undefined) === item.topic ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50"}`}
                >
                  <span className="truncate">{item.label}</span>
                  <span className="text-xs opacity-80">{item.count}</span>
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-800">
          {filtered ? `${total} soal ditemukan` : "Daftar soal"}
        </h2>
        {filtered ? (
          <Link
            href={base}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Hapus semua filter
          </Link>
        ) : (
          <span className="text-xs text-ink-500">
            Diurutkan berdasarkan topik
          </span>
        )}
      </div>
      {questions.length ? (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={{
                id: question.id,
                text: question.text,
                topic: question.topic,
                difficulty: question.difficulty,
                type: question.type,
                points: question.points,
                explanation: question.explanation,
                correctText: question.correctText,
                options: question.options.map(({ text, correct }) => ({
                  text,
                  correct,
                })),
                usageCount: question._count.assessments,
              }}
              course={course}
              topics={topicNames}
              number={(page - 1) * PAGE_SIZE + index + 1}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white">
          <EmptyState
            title={
              filtered
                ? "Tidak ada soal yang cocok"
                : "Mulai susun soal pertama Anda"
            }
            description={
              filtered
                ? "Coba kata pencarian lain atau hapus filter untuk melihat semua soal."
                : "Tambahkan pertanyaan, isi pilihan jawaban, lalu tentukan kunci yang benar."
            }
            action={
              filtered ? (
                <Button asChild variant="secondary">
                  <Link href={base}>Tampilkan semua soal</Link>
                </Button>
              ) : (
                <QuestionEditor course={course} topics={topicNames} />
              )
            }
          />
        </div>
      )}
      {total > PAGE_SIZE ? (
        <div className="mt-4 rounded-lg border border-ink-200 bg-white">
          <Pagination total={total} page={page} params={activeFilters} />
        </div>
      ) : null}
    </div>
  );
}
