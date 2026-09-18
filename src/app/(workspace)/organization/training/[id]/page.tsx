import { Breadcrumb, PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  StatCard,
} from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListEmpty, getPage, Pagination } from "@/components/ui/pagination";
import { ProgressBar } from "@/components/ui/progress";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { dateRange, daysBetween, labels } from "@/lib/utils";
import { ROWS_PER_PAGE, organizationBatch } from "@/services/batch";
import { bestScore } from "@/services/assessment";
import { attendanceRate } from "@/services/learning";

/**
 * Tampilan PIC perusahaan: kemajuan karyawannya sendiri. Jawaban ujian, isi
 * evaluasi, dan data peserta dari organisasi lain tidak ditampilkan — yang
 * dibutuhkan PIC adalah status penyelesaian, bukan rapor rinci.
 */
export default async function OrganizationTrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const [{ id }, filters] = await Promise.all([params, searchParams]);
  const page = getPage(filters.page);
  const q = filters.q?.trim() || undefined;

  const { batch, completed, issued } = await organizationBatch(id, { page, q });
  const total = batch._count.enrollments;

  const days = daysBetween(batch.startDate, batch.endDate).length;
  const finalExam = batch.assessments[0];
  const lessonTotal = batch.course.modules.reduce(
    (count, courseModule) =>
      count + courseModule.lessons.filter((lesson) => lesson.required).length,
    0,
  );

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { href: "/organization/training", label: "Training" },
          { label: batch.code },
        ]}
      />
      <PageHeader
        title={batch.title}
        meta={<StatusBadge value={batch.status} />}
        description={`${batch.course.title} · ${dateRange(batch.startDate, batch.endDate)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Karyawan terdaftar" value={total} />
        <StatCard label="Selesai" value={completed} />
        <StatCard label="Sertifikat terbit" value={issued} />
        <StatCard label="Hari pelatihan" value={days} />
      </div>

      <Card>
        <CardHeader title="Informasi training" />
        <CardBody>
          <DescriptionList
            items={[
              { term: "Kode training", value: batch.code },
              { term: "Course", value: batch.course.title },
              {
                term: "Jadwal",
                value: `${dateRange(batch.startDate, batch.endDate)} · ${batch.startTime}–${batch.endTime} WIB`,
              },
              { term: "Metode", value: labels[batch.mode] ?? batch.mode },
              { term: "Lokasi", value: batch.venue || "Belum ditentukan" },
              {
                term: "Trainer",
                value:
                  batch.trainers.map((link) => link.trainer.name).join(", ") ||
                  "Belum ditugaskan",
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Kemajuan karyawan"
          description="Status penyelesaian materi, kehadiran, dan sertifikat."
        />
        <FilterBar q={q} placeholder="Cari nama atau email karyawan…" />
        {batch.enrollments.length ? (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Karyawan</Th>
                    <Th className="w-48">Materi</Th>
                    <Th className="text-right">Kehadiran</Th>
                    {finalExam ? (
                      <Th className="text-right">Ujian akhir</Th>
                    ) : null}
                    <Th>Status</Th>
                    <Th>Sertifikat</Th>
                  </tr>
                </thead>
                <tbody>
                  {batch.enrollments.map((enrollment) => {
                    const score = finalExam
                      ? bestScore(
                          enrollment.attempts.filter(
                            (attempt) => attempt.assessmentId === finalExam.id,
                          ),
                        )
                      : null;
                    return (
                      <tr key={enrollment.id}>
                        <Td>
                          <p className="font-medium text-ink-900">
                            {enrollment.participant.name}
                          </p>
                          <p className="text-xs text-ink-500">
                            {enrollment.participant.jobTitle ||
                              enrollment.participant.email}
                          </p>
                        </Td>
                        <Td>
                          <ProgressBar
                            label={`${enrollment._count.lessons}/${lessonTotal}`}
                            value={
                              lessonTotal
                                ? (enrollment._count.lessons / lessonTotal) *
                                  100
                                : 0
                            }
                          />
                        </Td>
                        <Td className="tabular text-right text-sm">
                          {enrollment.attendance.length
                            ? `${attendanceRate(enrollment.attendance, days)}%`
                            : "—"}
                        </Td>
                        {finalExam ? (
                          <Td className="tabular text-right text-sm">
                            {score === null ? "—" : Math.round(score)}
                          </Td>
                        ) : null}
                        <Td>
                          <StatusBadge value={enrollment.status} />
                        </Td>
                        <Td className="tabular text-xs whitespace-nowrap">
                          {enrollment.certificate?.status === "ISSUED" ? (
                            <a
                              href={`/api/certificates/${enrollment.certificate.number}/pdf`}
                              className="text-brand-600 hover:underline"
                            >
                              {enrollment.certificate.number}
                            </a>
                          ) : (
                            <span className="text-ink-400">Belum terbit</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <Pagination
              total={total}
              page={page}
              size={ROWS_PER_PAGE}
              params={{ q }}
            />
          </>
        ) : (
          <ListEmpty
            total={total}
            q={q}
            subject="karyawan"
            title="Belum ada karyawan terdaftar"
            description="Hubungi administrator pelatihan untuk mendaftarkan karyawan pada kelas ini."
            params={{ q }}
          />
        )}
      </Card>
    </div>
  );
}
