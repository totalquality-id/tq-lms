import { Breadcrumb, PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  StatCard,
} from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateRange, daysBetween, labels } from "@/lib/utils";
import { accessibleBatch } from "@/services/access";
import { bestScore } from "@/services/assessment";
import { attendanceRate } from "@/services/learning";

/**
 * Tampilan PIC perusahaan: kemajuan karyawannya sendiri. Jawaban ujian, isi
 * evaluasi, dan data peserta dari organisasi lain tidak ditampilkan — yang
 * dibutuhkan PIC adalah status penyelesaian, bukan rapor rinci.
 */
export default async function OrganizationTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { batch } = await accessibleBatch(id);

  const enrollments = await db.enrollment.findMany({
    where: { batchId: id, deletedAt: null, status: { not: "CANCELLED" } },
    include: {
      participant: { select: { name: true, email: true, jobTitle: true } },
      attendance: true,
      attempts: true,
      lessons: true,
      certificate: true,
    },
    orderBy: { participant: { name: "asc" } },
  });

  const days = daysBetween(batch.startDate, batch.endDate).length;
  const finalExam = batch.assessments.find(
    (assessment) => assessment.type === "FINAL_EXAM",
  );
  const lessonTotal = batch.course.modules.reduce(
    (total, courseModule) =>
      total + courseModule.lessons.filter((lesson) => lesson.required).length,
    0,
  );
  const issued = enrollments.filter(
    (enrollment) => enrollment.certificate?.status === "ISSUED",
  ).length;

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
        <StatCard label="Karyawan terdaftar" value={enrollments.length} />
        <StatCard
          label="Selesai"
          value={
            enrollments.filter(
              (enrollment) => enrollment.status === "COMPLETED",
            ).length
          }
        />
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
        {enrollments.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Karyawan</Th>
                  <Th className="w-48">Materi</Th>
                  <Th className="text-right">Kehadiran</Th>
                  {finalExam ? <Th className="text-right">Ujian akhir</Th> : null}
                  <Th>Status</Th>
                  <Th>Sertifikat</Th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
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
                          label={`${enrollment.lessons.length}/${lessonTotal}`}
                          value={
                            lessonTotal
                              ? (enrollment.lessons.length / lessonTotal) * 100
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
        ) : (
          <EmptyState
            title="Belum ada karyawan terdaftar"
            description="Hubungi administrator pelatihan untuk mendaftarkan karyawan pada kelas ini."
          />
        )}
      </Card>
    </div>
  );
}
