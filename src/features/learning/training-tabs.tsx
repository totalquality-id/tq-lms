import { TabNav } from "@/components/ui/tabs";
import type { EnrollmentDetail } from "@/services/learning";

/**
 * Bagian-bagian training peserta. Tab yang tidak berisi apa-apa tidak
 * ditampilkan: halaman kosong yang selalu ada hanya membuat pembaca menebak
 * apakah sesuatu belum dibuat atau memang tidak berlaku.
 */
export function TrainingTabs({
  enrollment,
}: {
  enrollment: EnrollmentDetail;
}) {
  const root = `/my-training/${enrollment.batch.id}`;
  const { batch } = enrollment;

  return (
    <TabNav
      items={[
        { href: root, label: "Ringkasan" },
        { href: `${root}/learn`, label: "Materi" },
        ...(batch.assessments.length
          ? [
              {
                href: `${root}/assessment`,
                label: "Penilaian",
                badge: batch.assessments.length,
              },
            ]
          : []),
        ...(batch.assignments.length
          ? [
              {
                href: `${root}/assignment`,
                label: "Tugas",
                badge: batch.assignments.length,
              },
            ]
          : []),
        ...(batch.resources.length
          ? [{ href: `${root}/resources`, label: "Materi pendukung" }]
          : []),
        ...(batch.evaluation
          ? [{ href: `${root}/evaluation`, label: "Evaluasi" }]
          : []),
        { href: `${root}/certificate`, label: "Sertifikat" },
      ]}
    />
  );
}
