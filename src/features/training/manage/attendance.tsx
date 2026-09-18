import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListEmpty, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ROWS_PER_PAGE, batchAttendance } from "@/services/batch";
import { attendanceRate } from "@/services/learning";
import { calendarKey, daysBetween } from "@/lib/utils";
import { AttendanceCell } from "./attendance-cell";

/**
 * Satu kolom per hari pelatihan, satu baris per peserta. Bentuk ini
 * menyerupai lembar presensi kertas yang sudah dikenal panitia, dan membuat
 * hari yang belum terisi langsung terlihat sebagai kolom kosong.
 *
 * Barisnya berhalaman, kolomnya tidak: hari pelatihan berjumlah tetap dan
 * sudah diketahui sejak kelas dijadwalkan, sedangkan pesertanya bisa puluhan.
 */
export async function ManageAttendance({
  id,
  page,
  q,
}: {
  id: string;
  page: number;
  q?: string;
}) {
  const { batch } = await batchAttendance(id, { page, q });
  const days = daysBetween(batch.startDate, batch.endDate);
  const total = batch._count.enrollments;

  const dayLabel = (day: Date) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(day);

  if (!total && !q)
    return (
      <Card>
        <EmptyState
          title="Belum ada peserta"
          description="Presensi tersedia setelah peserta didaftarkan pada kelas ini."
        />
      </Card>
    );

  return (
    <Card>
      <CardHeader
        title="Presensi"
        description={`${days.length} hari pelatihan · syarat kehadiran minimum ${batch.minimumAttendance}%`}
      />
      <FilterBar q={q} placeholder="Cari nama peserta…" />
      {batch.enrollments.length ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="sticky left-0 z-10 bg-ink-50">Peserta</Th>
                  {days.map((day, index) => (
                    <Th key={day.toISOString()} className="text-center">
                      Hari {index + 1}
                      <span className="block text-[10px] font-normal normal-case">
                        {dayLabel(day)}
                      </span>
                    </Th>
                  ))}
                  <Th className="text-right">Rekap</Th>
                </tr>
              </thead>
              <tbody>
                {batch.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <Td className="sticky left-0 z-10 bg-white">
                      <p className="text-sm font-medium whitespace-nowrap text-ink-900">
                        {enrollment.participant.name}
                      </p>
                    </Td>
                    {days.map((day) => {
                      const key = calendarKey(day);
                      const record = enrollment.attendance.find(
                        (item) => calendarKey(item.date) === key,
                      );
                      return (
                        <Td key={key} className="text-center">
                          <AttendanceCell
                            batchId={id}
                            enrollmentId={enrollment.id}
                            date={key}
                            status={record?.status ?? ""}
                            participant={enrollment.participant.name}
                          />
                        </Td>
                      );
                    })}
                    <Td className="tabular text-right text-sm font-medium whitespace-nowrap">
                      {enrollment.attendance.length
                        ? `${attendanceRate(enrollment.attendance, days.length)}%`
                        : "—"}
                    </Td>
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
          description="Presensi tersedia setelah peserta didaftarkan pada kelas ini."
          params={{ q }}
        />
      )}
      <CardBody className="border-t border-ink-200">
        <p className="text-xs leading-relaxed text-ink-500">
          Status &ldquo;Izin&rdquo; tidak dihitung memberatkan maupun
          meringankan: hari tersebut dikeluarkan dari perhitungan persentase.
        </p>
      </CardBody>
    </Card>
  );
}
