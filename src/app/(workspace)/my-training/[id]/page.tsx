import Link from "next/link";

import { SectionHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
} from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/badge";
import { dateRange, daysBetween, labels } from "@/lib/utils";
import {
  attendanceRate,
  buildProgress,
  myEnrollment,
} from "@/services/learning";

const KIND_LABEL: Record<string, string> = {
  LESSON: "Pelajaran",
  ASSESSMENT: "Penilaian",
  ASSIGNMENT: "Tugas",
  EVALUATION: "Evaluasi",
};

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enrollment = await myEnrollment(id);
  const { batch } = enrollment;
  const progress = buildProgress(enrollment);
  const days = daysBetween(batch.startDate, batch.endDate);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Kemajuan belajar"
            description={`${progress.requiredDone} dari ${progress.requiredTotal} aktivitas wajib selesai`}
          />
          <CardBody className="space-y-4">
            <ProgressBar value={progress.percent} />
            {progress.next ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink-200 bg-ink-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink-500">
                    Aktivitas berikutnya · {KIND_LABEL[progress.next.kind]}
                  </p>
                  <p className="truncate text-sm font-medium text-ink-900">
                    {progress.next.title}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={progress.next.href}>Lanjutkan</Link>
                </Button>
              </div>
            ) : (
              <Note>
                Seluruh aktivitas wajib telah Anda selesaikan. Sertifikat
                diterbitkan setelah administrator memeriksa kelengkapan
                pelatihan.
              </Note>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Catatan Anda" />
          <CardBody>
            <DescriptionList
              className="sm:grid-cols-1"
              items={[
                {
                  term: "Status pendaftaran",
                  value: <StatusBadge value={enrollment.status} />,
                },
                {
                  term: "Pelajaran selesai",
                  value: `${progress.lessonsDone} dari ${progress.lessonsTotal}`,
                },
                {
                  term: "Kehadiran",
                  value: enrollment.attendance.length
                    ? `${attendanceRate(enrollment.attendance, days.length)}% dari ${days.length} hari`
                    : "Belum dicatat",
                },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Informasi training" />
        <CardBody className="space-y-4">
          <DescriptionList
            items={[
              { term: "Course", value: batch.course.title },
              {
                term: "Organisasi",
                value: batch.organization?.name ?? "Training umum",
              },
              {
                term: "Jadwal",
                value: `${dateRange(batch.startDate, batch.endDate)} · ${batch.startTime}–${batch.endTime} WIB`,
              },
              { term: "Metode", value: labels[batch.mode] ?? batch.mode },
              {
                term: "Lokasi",
                value: batch.venue || "Belum ditentukan",
              },
              {
                term: "Trainer",
                value:
                  batch.trainers.map((link) => link.trainer.name).join(", ") ||
                  "Belum ditugaskan",
              },
            ]}
          />
          {batch.meetingUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a
                href={batch.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka tautan pertemuan
              </a>
            </Button>
          ) : null}
          {batch.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink-600">
              {batch.description}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <section>
        <SectionHeader
          title="Daftar aktivitas"
          description="Urutan yang disarankan untuk menyelesaikan pelatihan ini."
        />
        <Card>
          <ul className="divide-y divide-ink-100">
            {progress.activities.map((activity) => (
              <li
                key={`${activity.kind}-${activity.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span
                  aria-hidden
                  className={
                    activity.done
                      ? "size-2 shrink-0 rounded-full bg-[var(--color-success)]"
                      : activity.locked
                        ? "size-2 shrink-0 rounded-full bg-ink-300"
                        : "size-2 shrink-0 rounded-full border border-ink-400"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-900">
                    {activity.title}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {KIND_LABEL[activity.kind]}
                    {activity.detail ? ` · ${activity.detail}` : ""}
                    {activity.required ? "" : " · opsional"}
                  </span>
                </span>
                {activity.locked ? (
                  <span className="text-xs text-ink-400">Terkunci</span>
                ) : (
                  <Button asChild variant="link" size="sm">
                    <Link href={activity.href}>
                      {activity.done ? "Lihat" : "Buka"}
                    </Link>
                  </Button>
                )}
              </li>
            ))}
            {progress.activities.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-ink-500">
                Materi dan penilaian untuk training ini sedang disiapkan.
              </li>
            ) : null}
          </ul>
        </Card>
      </section>
    </div>
  );
}
