import type { Metadata } from "next";
import { Archive } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import {
  RestoreButton,
  DeleteButton,
} from "@/features/management/archive-actions";
import {
  listArchived,
  ARCHIVE_CATEGORIES,
  type ArchiveCategory,
} from "@/services/archive";
import { requireAdmin } from "@/services/access";
import { date } from "@/lib/utils";

export const metadata: Metadata = { title: "Arsip" };

const CATEGORY_LABELS: Record<ArchiveCategory, string> = {
  course: "Course",
  organization: "Organisasi",
  batch: "Training",
  question: "Soal",
  assessment: "Penilaian",
  assignment: "Tugas",
};

const CATEGORY_TONES: Record<
  ArchiveCategory,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  course: "info",
  organization: "neutral",
  batch: "warning",
  question: "success",
  assessment: "danger",
  assignment: "neutral",
};

export default async function ArchivesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const page = getPage(filters.page);

  const category = ARCHIVE_CATEGORIES.some((c) => c.value === filters.category)
    ? (filters.category as ArchiveCategory)
    : undefined;

  const { items, total } = await listArchived(
    category,
    filters.q ?? "",
    page,
    PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader
        title="Arsip"
        description="Data yang telah diarsipkan. Pulihkan untuk mengembalikan ke daftar aktif, atau hapus permanen jika tidak diperlukan lagi."
      />
      <Card>
        <FilterBar
          q={filters.q}
          placeholder="Cari nama atau judul…"
          filters={[
            {
              name: "category",
              value: filters.category,
              label: "Filter kategori",
              anyLabel: "Semua kategori",
              options: ARCHIVE_CATEGORIES.map((c) => ({
                value: c.value,
                label: c.label,
              })),
            },
          ]}
        />
        {items.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Kategori</Th>
                  <Th>Diarsipkan</Th>
                  <Th>
                    <span className="sr-only">Tindakan</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.category}-${item.id}`}>
                    <Td>
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500">
                          <Archive className="size-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900 break-words">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={CATEGORY_TONES[item.category]}>
                        {CATEGORY_LABELS[item.category]}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {date(item.archivedAt)}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <RestoreButton
                          category={item.category}
                          id={item.id}
                          title={item.title}
                        />
                        <DeleteButton
                          category={item.category}
                          id={item.id}
                          title={item.title}
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Tidak ada data yang diarsipkan"
            description={
              filters.q || category
                ? "Coba ubah kata pencarian atau pilih kategori lain."
                : "Data yang diarsipkan dari course, training, soal, dan lainnya akan muncul di sini."
            }
          />
        )}
        <Pagination
          total={total}
          page={page}
          params={{ q: filters.q, category: filters.category }}
        />
      </Card>
    </div>
  );
}
