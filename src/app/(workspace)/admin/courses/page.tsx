import type { Metadata } from "next";
import Link from "@/components/ui/navigation-link";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EntityForm } from "@/features/management/entity-form";
import { courseFields } from "@/features/management/fields";
import { db } from "@/lib/db";
import { requireAdmin } from "@/services/access";

export const metadata: Metadata = { title: "Course" };

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const page = getPage(filters.page);

  const where = {
    deletedAt: null,
    sourceCourseId: null,
    ...(filters.status === "draft"
      ? { published: false }
      : filters.status === "published"
        ? { published: true }
        : {}),
    title: { contains: filters.q ?? "", mode: "insensitive" as const },
  };

  const [courses, total] = await Promise.all([
    db.course.findMany({
      where,
      include: {
        _count: { select: { modules: true, copies: { where: { batches: { some: {} } } }, questions: true } },
      },
      orderBy: { title: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.course.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Course"
        description="Course induk yang disalin saat membuat training. Perubahan di sini hanya berlaku untuk training baru."
        action={
          <EntityForm
            entity="course"
            title="Buat course"
            fields={courseFields()}
            icon
          />
        }
      />
      <Card>
        <FilterBar
          q={filters.q}
          placeholder="Cari judul course…"
          filters={[
            {
              name: "status",
              value: filters.status,
              label: "Filter status",
              anyLabel: "Semua status",
              options: [
                { value: "published", label: "Dipublikasikan" },
                { value: "draft", label: "Draft" },
              ],
            },
          ]}
        />
        {courses.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Course</Th>
                  <Th>Kategori</Th>
                  <Th className="text-right">Durasi</Th>
                  <Th className="text-right">Modul</Th>
                  <Th className="text-right">Soal</Th>
                  <Th className="text-right">Training</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-ink-50">
                    <Td>
                      <Link
                        href={`/admin/courses/${course.id}`}
                        className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
                      >
                        {course.title}
                      </Link>
                      <p className="max-w-md truncate text-xs text-ink-500">
                        {course.shortDescription}
                      </p>
                    </Td>
                    <Td className="text-sm whitespace-nowrap">
                      {course.category}
                    </Td>
                    <Td className="tabular text-right text-sm whitespace-nowrap">
                      {course.duration} jam
                    </Td>
                    <Td className="tabular text-right text-sm">
                      {course._count.modules}
                    </Td>
                    <Td className="tabular text-right text-sm">
                      {course._count.questions}
                    </Td>
                    <Td className="tabular text-right text-sm">
                      {course._count.copies}
                    </Td>
                    <Td>
                      <StatusBadge
                        value={course.published ? "PUBLISHED" : "DRAFT"}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Belum ada course"
            description="Buat course pertama untuk mulai menyusun modul dan pelajaran."
          />
        )}
        <Pagination
          total={total}
          page={page}
          params={{ q: filters.q, status: filters.status }}
        />
      </Card>
    </div>
  );
}
