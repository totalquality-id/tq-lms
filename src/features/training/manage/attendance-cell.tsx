"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { attendanceAction } from "@/app/staff-actions";
import { Select } from "@/components/ui/input";

const OPTIONS = [
  { value: "", label: "—" },
  { value: "PRESENT", label: "Hadir" },
  { value: "LATE", label: "Terlambat" },
  { value: "EXCUSED", label: "Izin" },
  { value: "ABSENT", label: "Tidak hadir" },
];

/**
 * Satu sel presensi. Perubahan langsung tampak lalu dikirim ke server; bila
 * penyimpanan gagal, nilainya kembali ke keadaan terakhir yang diketahui
 * server — bukan dibiarkan terlihat tersimpan padahal tidak.
 */
export function AttendanceCell({
  batchId,
  enrollmentId,
  date,
  status,
  participant,
}: {
  batchId: string;
  enrollmentId: string;
  date: string;
  status: string;
  participant: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(status);

  return (
    <Select
      aria-label={`Presensi ${participant} pada ${date}`}
      value={shown}
      disabled={pending}
      className="h-8 w-auto min-w-28 text-xs"
      onChange={(event) => {
        const next = event.target.value;
        if (!next) return;
        start(async () => {
          setShown(next);
          const result = await attendanceAction(
            batchId,
            enrollmentId,
            date,
            next,
          );
          if (result.error) toast.error(result.error);
          router.refresh();
        });
      }}
    >
      {OPTIONS.filter((option) => option.value || !status).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
