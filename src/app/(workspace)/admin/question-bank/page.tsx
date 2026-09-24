import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "@/components/ui/navigation-link";
import { redirect } from "next/navigation";
import { BookOpen, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  getPage,
  PAGE_SIZE,
  Pagination,
  ListEmpty,
} from "@/components/ui/pagination";
import { db } from "@/lib/db";
import { requireAdmin } from "@/services/access";

export const metadata: Metadata = { title: "Bank soal" };

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    courseId?: string;
    topic?: string;
    type?: string;
    difficulty?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  // Tautan filter course lama tetap menuju bank soal yang bersangkutan.
  if (filters.courseId) {
    const search = new URLSearchParams();
    for (const key of ["q", "topic", "type", "difficulty", "page"] as const) {
      if (filters[key]) search.set(key, filters[key]);
    }
    redirect(
      `/admin/question-bank/${encodeURIComponent(filters.courseId)}${search.size ? `?${search}` : ""}`,
    );
  }
  const page = getPage(filters.page);
  const where: Prisma.CourseWhereInput = {
    deletedAt: null,
    sourceCourseId: null,
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: "insensitive" } },
            { code: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [courses, total] = await Promise.all([
    db.course.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        _count: { select: { questions: { where: { deletedAt: null } } } },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.course.count({ where }),
  ]);
  const topics = courses.length
    ? await db.question.groupBy({
        by: ["courseId", "topic"],
        where: {
          courseId: { in: courses.map((course) => course.id) },
          deletedAt: null,
        },
      })
    : [];
  const topicCounts = new Map<string, number>();
  for (const { courseId } of topics)
    topicCounts.set(courseId, (topicCounts.get(courseId) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title="Bank soal"
        description="Pilih course untuk menambah dan mengelola soalnya."
      />
      <Card>
        <FilterBar q={filters.q} placeholder="Cari nama atau kode course…" />
        {courses.length ? (
          <ul className="divide-y divide-ink-100">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <BookOpen className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/admin/question-bank/${course.id}`}
                      className="font-semibold break-words text-ink-900 hover:text-brand-700 hover:underline"
                    >
                      {course.title}
                    </Link>
                    <p className="mt-1 text-xs text-ink-500">
                      {course.category}
                    </p>
                    <p className="mt-1 text-sm text-ink-600">
                      {course._count.questions} soal ·{" "}
                      {topicCounts.get(course.id) ?? 0} topik
                    </p>
                  </div>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={`/admin/question-bank/${course.id}`}
                    aria-label={`Kelola soal ${course.title}`}
                  >
                    Kelola soal <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <ListEmpty
            total={total}
            q={filters.q}
            subject="course"
            title="Belum ada course"
            params={{ q: filters.q }}
            description="Buat course melalui menu Course terlebih dahulu untuk mulai menyusun bank soal."
          />
        )}
        <Pagination total={total} page={page} params={{ q: filters.q }} />
      </Card>
    </div>
  );
}
