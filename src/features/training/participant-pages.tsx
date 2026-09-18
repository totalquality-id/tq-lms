import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateRange } from "@/lib/utils";
import { currentUser } from "@/services/access";
import { buildProgress, enrollmentInclude } from "@/services/learning";

const listInclude = enrollmentInclude satisfies Prisma.EnrollmentInclude;

async function myEnrollments(where: Prisma.EnrollmentWhereInput = {}) {
  const user = await currentUser();
  return db.enrollment.findMany({
    where: {
      participantId: user.id,
      deletedAt: null,
      status: { not: "CANCELLED" },
      batch: { deletedAt: null },
      ...where,
    },
    include: listInclude,
    orderBy: { batch: { startDate: "desc" } },
    take: 50,
  });
}

/** Kartu satu training pada daftar peserta: judul, jadwal, dan kemajuannya. */
function TrainingCard({
  enrollment,
}: {
  enrollment: Awaited<ReturnType<typeof myEnrollments>>[number];
}) {
  const progress = buildProgress(enrollment);
  const { batch } = enrollment;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/my-training/${batch.id}`}
              className="text-sm font-medium text-ink-900 hover:text-brand-700 hover:underline"
            >
              {batch.title}
            </Link>
            <p className="mt-0.5 text-xs text-ink-500">
              {batch.organization?.name ?? "Training umum"} ·{" "}
              {dateRange(batch.startDate, batch.endDate)}
            </p>
          </div>
          <StatusBadge value={batch.status} />
        </div>

        <ProgressBar value={progress.percent} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-500">
            {progress.next
              ? `Berikutnya: ${progress.next.title}`
              : "Seluruh aktivitas wajib selesai"}
          </p>
          <Button asChild variant="link" size="sm">
            <Link href={`/my-training/${batch.id}`}>Buka</Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export async function ParticipantDashboard() {
  const user = await currentUser();
  const enrollments = await myEnrollments();

  const ongoing = enrollments.filter(
    (item) => item.batch.status === "ONGOING" || item.batch.status === "OPEN",
  );
  const completed = enrollments.filter(
    (item) => item.batch.status === "COMPLETED",
  );
  const certificates = enrollments.filter(
    (item) => item.certificate?.status === "ISSUED",
  ).length;

  // Kelas yang benar-benar sedang berlangsung didahulukan; pendaftaran yang
  // masih terbuka baru relevan setelah itu, diurutkan dari yang paling dekat.
  const current =
    ongoing.find((item) => item.batch.status === "ONGOING") ??
    [...ongoing].sort(
      (a, b) => a.batch.startDate.getTime() - b.batch.startDate.getTime(),
    )[0];
  const currentProgress = current ? buildProgress(current) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Selamat datang, ${user.name.split(" ")[0]}`}
        description="Ringkasan pelatihan yang sedang Anda ikuti."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Training diikuti" value={enrollments.length} />
        <StatCard label="Sedang berjalan" value={ongoing.length} />
        <StatCard label="Selesai" value={completed.length} />
        <StatCard label="Sertifikat" value={certificates} />
      </div>

      {current && currentProgress ? (
        <Card>
          <CardHeader
            title="Training saat ini"
            description={`${current.batch.organization?.name ?? "Training umum"} · ${dateRange(current.batch.startDate, current.batch.endDate)}`}
            action={<StatusBadge value={current.batch.status} />}
          />
          <CardBody className="space-y-4">
            <p className="text-base font-medium text-ink-900">
              {current.batch.title}
            </p>
            <ProgressBar value={currentProgress.percent} />
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-500">Aktivitas berikutnya</dt>
                <dd className="mt-0.5 text-sm text-ink-800">
                  {currentProgress.next?.title ?? "Semua aktivitas selesai"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Trainer</dt>
                <dd className="mt-0.5 text-sm text-ink-800">
                  {current.batch.trainers
                    .map((link) => link.trainer.name)
                    .join(", ") || "Belum ditugaskan"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Pelajaran selesai</dt>
                <dd className="tabular mt-0.5 text-sm text-ink-800">
                  {currentProgress.lessonsDone} dari{" "}
                  {currentProgress.lessonsTotal}
                </dd>
              </div>
            </dl>
            <Button asChild>
              <Link
                href={
                  currentProgress.next?.href ??
                  `/my-training/${current.batch.id}`
                }
              >
                {currentProgress.next ? "Lanjutkan belajar" : "Buka training"}
              </Link>
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <section>
        <SectionHeader
          title="Training saya"
          description="Seluruh pelatihan yang terdaftar atas nama Anda."
          href="/my-training"
        />
        {enrollments.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {enrollments.slice(0, 4).map((enrollment) => (
              <TrainingCard key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              title="Belum ada training"
              description="Training akan muncul di sini setelah administrator mendaftarkan Anda."
            />
          </Card>
        )}
      </section>
    </div>
  );
}

export async function ParticipantTrainingList() {
  const enrollments = await myEnrollments();

  return (
    <div>
      <PageHeader
        title="Training saya"
        description="Materi, penilaian, dan jadwal setiap pelatihan Anda."
      />
      {enrollments.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {enrollments.map((enrollment) => (
            <TrainingCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="Belum ada training"
            description="Training akan muncul di sini setelah administrator mendaftarkan Anda."
          />
        </Card>
      )}
    </div>
  );
}
