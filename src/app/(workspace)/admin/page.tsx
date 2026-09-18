import Link from "next/link";

import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { CreateTraining } from "@/features/training/create-training";
import { TrainingTable } from "@/features/training/training-table";
import { db } from "@/lib/db";
import { dateRange } from "@/lib/utils";
import { trainingInclude } from "@/repositories/training";
import { requireAdmin } from "@/services/access";

export default async function AdminDashboard() {
  await requireAdmin();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    active,
    thisMonth,
    participants,
    certificates,
    running,
    upcoming,
    draftCourses,
    withoutTrainer,
    withoutParticipants,
    pendingAssignments,
    pendingEssays,
    resetRequests,
    neverInvited,
  ] = await Promise.all([
    db.trainingBatch.count({ where: { deletedAt: null, status: "ONGOING" } }),
    db.trainingBatch.count({
      where: {
        deletedAt: null,
        startDate: { gte: monthStart, lt: monthEnd },
      },
    }),
    db.user.count({
      where: { role: "PARTICIPANT", active: true, deletedAt: null },
    }),
    db.certificate.count({ where: { status: "ISSUED" } }),
    db.trainingBatch.findMany({
      where: { deletedAt: null, status: { in: ["ONGOING", "OPEN"] } },
      include: trainingInclude,
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
      take: 6,
    }),
    db.trainingBatch.findMany({
      where: {
        deletedAt: null,
        startDate: { gte: now },
        status: { in: ["OPEN", "DRAFT"] },
      },
      include: { organization: true },
      orderBy: { startDate: "asc" },
      take: 5,
    }),
    db.course.count({ where: { deletedAt: null, published: false } }),
    db.trainingBatch.count({
      where: {
        deletedAt: null,
        status: { in: ["OPEN", "DRAFT", "ONGOING"] },
        trainers: { none: {} },
      },
    }),
    db.trainingBatch.count({
      where: {
        deletedAt: null,
        status: "OPEN",
        enrollments: { none: { deletedAt: null } },
      },
    }),
    db.assignmentSubmission.count({
      where: { status: "SUBMITTED", assignment: { deletedAt: null } },
    }),
    db.assessmentAttempt.count({
      where: { submittedAt: { not: null }, score: null },
    }),
    // Permintaan penyetelan ulang menunggu administrator meneruskan tautannya.
    // Tanpa hitungan ini, permintaan peserta tidak pernah sampai ke siapa pun:
    // pengiriman surel belum aktif, jadi dashboard inilah kotak masuknya.
    db.authToken.count({
      where: {
        purpose: "RESET",
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { active: true, deletedAt: null },
      },
    }),
    db.user.count({
      where: {
        active: true,
        deletedAt: null,
        isDemo: false,
        authId: null,
      },
    }),
  ]);

  const actions = [
    {
      count: resetRequests,
      title: "Permintaan kata sandi menunggu tautan",
      href: "/admin/users",
    },
    {
      count: neverInvited,
      title: "Akun belum diundang",
      href: "/admin/users",
    },
    {
      count: pendingAssignments,
      title: "Tugas menunggu penilaian",
      href: "/trainer/reviews",
    },
    {
      count: pendingEssays,
      title: "Esai menunggu pemeriksaan",
      href: "/trainer/reviews",
    },
    {
      count: withoutTrainer,
      title: "Training tanpa trainer",
      href: "/admin/training",
    },
    {
      count: withoutParticipants,
      title: "Training belum berpeserta",
      href: "/admin/training?status=OPEN",
    },
    {
      count: draftCourses,
      title: "Course masih draft",
      href: "/admin/courses?status=draft",
    },
  ].filter((action) => action.count > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional pelatihan Total Quality Indonesia."
        action={<CreateTraining />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Training berlangsung"
          value={active}
          hint="Kelas aktif saat ini"
        />
        <StatCard
          label="Training bulan ini"
          value={thisMonth}
          hint="Berdasarkan tanggal mulai"
        />
        <StatCard
          label="Peserta aktif"
          value={participants}
          hint="Akun peserta terdaftar"
        />
        <StatCard
          label="Sertifikat terbit"
          value={certificates}
          hint="Sejak awal pencatatan"
        />
      </div>

      {actions.length ? (
        <section>
          <SectionHeader
            title="Perlu ditindaklanjuti"
            description="Hal yang menahan pelatihan berjalan atau ditutup."
          />
          <Card>
            <ul className="divide-y divide-ink-100">
              {actions.map((action) => (
                <li key={action.title}>
                  <Link
                    href={action.href}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-ink-50 sm:px-5"
                  >
                    <span className="tabular w-8 shrink-0 text-lg font-semibold text-brand-700">
                      {action.count}
                    </span>
                    <span className="flex-1 text-sm text-ink-800">
                      {action.title}
                    </span>
                    <span className="text-xs text-ink-400">Buka</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-3">
        <section className="2xl:col-span-2">
          <SectionHeader
            title="Training aktif"
            description="Kelas yang sedang berjalan atau dibuka pendaftarannya."
            href="/admin/training"
          />
          <Card>
            <TrainingTable items={running} />
          </Card>
        </section>

        <section>
          <SectionHeader
            title="Jadwal mendatang"
            description="Training berikutnya yang perlu disiapkan."
          />
          <Card>
            {upcoming.length ? (
              <ul className="divide-y divide-ink-100">
                {upcoming.map((batch) => (
                  <li key={batch.id}>
                    <Link
                      href={`/admin/training/${batch.id}`}
                      className="block px-4 py-3 hover:bg-ink-50 sm:px-5"
                    >
                      <p className="text-sm font-medium text-ink-900">
                        {batch.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {dateRange(batch.startDate, batch.endDate)} ·{" "}
                        {batch.organization?.name ?? "Training umum"}
                      </p>
                      <StatusBadge className="mt-1.5" value={batch.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody>
                <EmptyState
                  title="Belum ada jadwal"
                  description="Buat training untuk menjadwalkan course, trainer, dan pesertanya."
                />
              </CardBody>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
