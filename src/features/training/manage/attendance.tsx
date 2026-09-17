import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { accessibleBatch } from "@/services/access";
import { attendanceRate } from "@/services/learning";
import { calendarKey, daysBetween } from "@/lib/utils";
import { AttendanceCell } from "./attendance-cell";

/**
 * Satu kolom per hari pelatihan, satu baris per peserta. Bentuk ini
 * menyerupai lembar presensi kertas yang sudah dikenal panitia, dan membuat
 * hari yang belum terisi langsung terlihat sebagai kolom kosong.
 */
export async function ManageAttendance({ id }: { id: string }) {
  const { batch } = await accessibleBatch(id);
  const days = daysBetween(batch.startDate, batch.endDate);

  const dayLabel = (day: Date) =>
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(day);

  if (!batch.enrollments.length)
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
      <CardBody className="border-t border-ink-200">
        <p className="text-xs leading-relaxed text-ink-500">
          Status &ldquo;Izin&rdquo; tidak dihitung memberatkan maupun
          meringankan: hari tersebut dikeluarkan dari perhitungan persentase.
        </p>
      </CardBody>
    </Card>
  );
}
