import { TabNav } from "@/components/ui/tabs";

/**
 * Bagian pengelolaan satu training. Susunannya mengikuti urutan pekerjaan
 * panitia: siapa pesertanya, apakah mereka hadir, apa yang dinilai, lalu
 * sertifikatnya.
 */
export function ManageTabs({
  base,
  id,
  counts,
}: {
  base: string;
  id: string;
  counts: {
    participants: number;
    assessments: number;
    assignments: number;
    resources: number;
  };
}) {
  const root = `${base}/${id}`;
  return (
    <TabNav
      items={[
        { href: root, label: "Ringkasan" },
        {
          href: `${root}/participants`,
          label: "Peserta",
          badge: counts.participants,
        },
        { href: `${root}/attendance`, label: "Presensi" },
        {
          href: `${root}/assessments`,
          label: "Penilaian",
          badge: counts.assessments,
        },
        {
          href: `${root}/assignments`,
          label: "Tugas",
          badge: counts.assignments,
        },
        {
          href: `${root}/resources`,
          label: "Materi",
          badge: counts.resources,
        },
        { href: `${root}/evaluation`, label: "Evaluasi" },
        { href: `${root}/certificates`, label: "Sertifikat" },
      ]}
    />
  );
}
