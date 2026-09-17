import Link from "next/link";

import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card, CardBody, StatCard } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/table";
import { TrainingTable } from "@/features/training/training-table";
import { db } from "@/lib/db";
import { batchScope } from "@/lib/policy";
import { listTraining, trainingInclude } from "@/repositories/training";
import { currentUser } from "@/services/access";
import { pendingSubmissions } from "@/services/operations";

/** Dashboard trainer: kelas yang diampu dan pekerjaan penilaian yang menunggu. */
export async function TrainerDashboard() {
  const user = await currentUser();
  const scope = batchScope(user);

  const [active, upcoming, completed, running, submissions, essays] =
    await Promise.all([
      db.trainingBatch.count({ where: { AND: [scope, { status: "ONGOING" }] } }),
      db.trainingBatch.count({ where: { AND: [scope, { status: "OPEN" }] } }),
      db.trainingBatch.count({
        where: { AND: [scope, { status: "COMPLETED" }] },
      }),
      db.trainingBatch.findMany({
        where: { AND: [scope, { status: { in: ["ONGOING", "OPEN"] } }] },
        include: trainingInclude,
        orderBy: { startDate: "asc" },
        take: 6,
      }),
      pendingSubmissions(),
      db.assessmentAttempt.count({
        where: {
          submittedAt: { not: null },
          score: null,
          assessment: { batch: { trainers: { some: { trainerId: user.id } } } },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${user.name.split(" ")[0]}`}
        description="Kelas yang Anda ampu dan penilaian yang menunggu."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kelas berlangsung" value={active} />
        <StatCard label="Kelas mendatang" value={upcoming} />
        <StatCard label="Kelas selesai" value={completed} />
        <StatCard
          label="Menunggu penilaian"
          value={submissions.length + essays}
          hint={`${submissions.length} tugas · ${essays} esai`}
        />
      </div>

      {submissions.length || essays ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-700">
              Ada {submissions.length} tugas dan {essays} jawaban esai yang
              menunggu pemeriksaan Anda.
            </p>
            <Link
              href="/trainer/reviews"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Buka daftar penilaian
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <section>
        <SectionHeader
          title="Kelas aktif"
          description="Hanya training yang ditugaskan kepada Anda."
          href="/trainer/training"
        />
        <Card>
          <TrainingTable
            items={running}
            base="/trainer/training"
            empty="Belum ada kelas aktif"
            emptyDescription="Kelas muncul di sini setelah administrator menugaskan Anda."
          />
        </Card>
      </section>
    </div>
  );
}

/** Daftar training untuk trainer dan PIC perusahaan. */
export async function StaffTrainingList({
  base,
  title,
  description,
  searchParams,
}: {
  base: string;
  title: string;
  description: string;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const page = getPage(filters.page);
  const user = await currentUser();
  const { items, total } = await listTraining(
    user,
    filters.q,
    filters.status,
    page,
    PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <FilterBar
          q={filters.q}
          placeholder="Cari nama atau kode training…"
          filters={[
            {
              name: "status",
              value: filters.status,
              label: "Filter status",
              anyLabel: "Semua status",
              options: ["OPEN", "ONGOING", "COMPLETED"],
            },
          ]}
        />
        {items.length ? (
          <TrainingTable items={items} base={base} />
        ) : (
          <EmptyState
            title="Tidak ada training yang cocok"
            description="Ubah penyaring, atau tunggu administrator menugaskan kelas berikutnya."
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
