import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListEmpty, Pagination } from "@/components/ui/pagination";
import { ProgressBar } from "@/components/ui/progress";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ArchiveButton, EntityForm } from "@/features/management/entity-form";
import { db } from "@/lib/db";
import { daysBetween } from "@/lib/utils";
import { ROWS_PER_PAGE, batchParticipants } from "@/services/batch";
import { attendanceRate } from "@/services/learning";

export async function ManageParticipants({
  id,
  page,
  q,
}: {
  id: string;
  page: number;
  q?: string;
}) {
  const { batch, admin } = await batchParticipants(id, { page, q });
  const total = batch._count.enrollments;

  // Calon peserta dibatasi ke organisasi training: mendaftarkan karyawan
  // perusahaan lain ke kelas tertutup adalah kekeliruan yang mahal.
  const candidates = admin
    ? await db.user.findMany({
        where: {
          role: "PARTICIPANT",
          active: true,
          deletedAt: null,
          ...(batch.organizationId
            ? {
                memberships: { some: { organizationId: batch.organizationId } },
              }
            : {}),
          enrollments: {
            none: {
              batchId: id,
              deletedAt: null,
              status: { not: "CANCELLED" },
            },
          },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 500,
      })
    : [];

  const days = daysBetween(batch.startDate, batch.endDate).length;
  const lessonTotal = batch.course.modules.reduce(
    (count, courseModule) =>
      count + courseModule.lessons.filter((lesson) => lesson.required).length,
    0,
  );

  return (
    <Card>
      <CardHeader
        title="Peserta"
        description={
          q
            ? `${total} peserta cocok dengan pencarian · kapasitas ${batch.capacity}`
            : `${total} terdaftar dari kapasitas ${batch.capacity}`
        }
        action={
          admin ? (
            <EntityForm
              entity="enrollment"
              parentId={id}
              title="Daftarkan peserta"
              size="sm"
              fields={[
                {
                  name: "participantId",
                  label: "Peserta",
                  required: true,
                  full: true,
                  options: [
                    { value: "", label: "Pilih peserta" },
                    ...candidates.map((candidate) => ({
                      value: candidate.id,
                      label: `${candidate.name} · ${candidate.email}`,
                    })),
                  ],
                  help: batch.organizationId
                    ? "Hanya karyawan organisasi training ini yang dapat didaftarkan."
                    : undefined,
                },
              ]}
            />
          ) : null
        }
      />
      <FilterBar q={q} placeholder="Cari nama atau email peserta…" />
      {batch.enrollments.length ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Peserta</Th>
                  <Th>Status</Th>
                  <Th className="w-48">Materi</Th>
                  <Th className="text-right">Kehadiran</Th>
                  <Th>Sertifikat</Th>
                  {admin ? (
                    <Th>
                      <span className="sr-only">Tindakan</span>
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {batch.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <Td>
                      <p className="font-medium text-ink-900">
                        {enrollment.participant.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {enrollment.participant.email}
                      </p>
                    </Td>
                    <Td>
                      <StatusBadge value={enrollment.status} />
                    </Td>
                    <Td>
                      <ProgressBar
                        label={`${enrollment._count.lessons}/${lessonTotal}`}
                        value={
                          lessonTotal
                            ? (enrollment._count.lessons / lessonTotal) * 100
                            : 0
                        }
                      />
                    </Td>
                    <Td className="tabular text-right text-sm">
                      {enrollment.attendance.length
                        ? `${attendanceRate(enrollment.attendance, days)}%`
                        : "—"}
                    </Td>
                    <Td>
                      {enrollment.certificate &&
                      enrollment.certificate.status !== "DRAFT" ? (
                        <span className="tabular text-xs whitespace-nowrap text-ink-700">
                          {enrollment.certificate.number}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400">
                          Belum terbit
                        </span>
                      )}
                    </Td>
                    {admin ? (
                      <Td className="text-right">
                        <ArchiveButton
                          entity="enrollment"
                          id={enrollment.id}
                          label="Batalkan"
                          description="Peserta dikeluarkan dari kelas ini. Riwayat belajar yang sudah tercatat tetap tersimpan."
                        />
                      </Td>
                    ) : null}
                  </tr>
                ))}
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
          subject="peserta"
          title="Belum ada peserta"
          description="Daftarkan peserta untuk memulai kelas ini."
          params={{ q }}
        />
      )}
    </Card>
  );
}
