import { issueCertificateAction } from "@/app/staff-actions";
import { ActionButton } from "@/components/ui/action-button";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { ListEmpty, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ROWS_PER_PAGE, batchCertificates } from "@/services/batch";
import { checkEligibility } from "@/services/certificate";

export async function ManageCertificates({
  id,
  page,
  q,
}: {
  id: string;
  page: number;
  q?: string;
}) {
  const {
    batch,
    rows: enrollments,
    total,
  } = await batchCertificates(id, {
    page,
    q,
  });

  if (!total && !q)
    return (
      <Card>
        <EmptyState
          title="Belum ada peserta"
          description="Sertifikat diterbitkan per peserta setelah syarat kelulusan terpenuhi."
        />
      </Card>
    );

  // Dihitung dari baris yang sedang ditampilkan: pemeriksaan kelulusan
  // membaca presensi, percobaan, dan pengumpulan satu per satu, dan
  // menjalankannya untuk seluruh kelas hanya demi satu angka di kepala kartu
  // akan mengembalikan ongkos yang baru saja dihemat oleh penomoran halaman.
  const ready = enrollments.filter(
    (enrollment) =>
      checkEligibility(enrollment).eligible &&
      enrollment.certificate?.status !== "ISSUED",
  ).length;

  return (
    <Card>
      <CardHeader
        title="Sertifikat"
        description={
          ready
            ? `${ready} peserta pada halaman ini memenuhi syarat dan siap diterbitkan sertifikatnya.`
            : "Sertifikat terbit hanya ketika seluruh syarat kelulusan peserta terpenuhi."
        }
      />
      <FilterBar q={q} placeholder="Cari nama atau email peserta…" />
      {enrollments.length ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Peserta</Th>
                  <Th>Syarat kelulusan</Th>
                  <Th>Sertifikat</Th>
                  <Th>
                    <span className="sr-only">Tindakan</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const { eligible, requirements } =
                    checkEligibility(enrollment);
                  const certificate = enrollment.certificate;
                  const issued = certificate?.status === "ISSUED";

                  return (
                    <tr key={enrollment.id}>
                      <Td>
                        <p className="font-medium whitespace-nowrap text-ink-900">
                          {enrollment.participant.name}
                        </p>
                        <p className="text-xs text-ink-500">
                          {enrollment.participant.email}
                        </p>
                      </Td>
                      <Td>
                        <ul className="space-y-0.5">
                          {requirements.map((requirement) => (
                            <li
                              key={requirement.label}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                aria-hidden
                                className={
                                  requirement.met
                                    ? "size-1.5 shrink-0 rounded-full bg-[var(--color-success)]"
                                    : "size-1.5 shrink-0 rounded-full bg-ink-300"
                                }
                              />
                              <span className="text-ink-700">
                                {requirement.label}
                              </span>
                              <span className="text-ink-500">
                                {requirement.detail}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </Td>
                      <Td>
                        {certificate && certificate.status !== "DRAFT" ? (
                          <>
                            <p className="tabular text-xs whitespace-nowrap text-ink-800">
                              {certificate.number}
                            </p>
                            <StatusBadge
                              className="mt-1"
                              value={certificate.status}
                            />
                          </>
                        ) : (
                          <span className="text-xs text-ink-400">
                            Belum terbit
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {issued ? (
                          <Button asChild variant="secondary" size="sm">
                            <a
                              href={`/api/certificates/${certificate.number}/pdf`}
                            >
                              Unduh PDF
                            </a>
                          </Button>
                        ) : (
                          <ActionButton
                            size="sm"
                            disabled={!eligible}
                            action={issueCertificateAction.bind(
                              null,
                              id,
                              enrollment.id,
                            )}
                            confirm={{
                              title: "Terbitkan sertifikat?",
                              description: `Nomor sertifikat untuk ${enrollment.participant.name} dibuat permanen dan pendaftarannya ditandai selesai. Pembatalan hanya dapat dilakukan dengan pencabutan.`,
                            }}
                            confirmLabel="Terbitkan"
                          >
                            Terbitkan
                          </ActionButton>
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
          subject="peserta"
          title="Belum ada peserta"
          description="Sertifikat diterbitkan per peserta setelah syarat kelulusan terpenuhi."
          params={{ q }}
        />
      )}
      <CardBody className="border-t border-ink-200">
        <p className="text-xs leading-relaxed text-ink-500">
          Syarat mengikuti pengaturan training: kehadiran minimum{" "}
          {batch.minimumAttendance}%, kelulusan ujian akhir, tugas wajib yang
          sudah dinilai, dan pengisian evaluasi. Syarat yang tidak berlaku pada
          kelas ini dianggap terpenuhi.
        </p>
      </CardBody>
    </Card>
  );
}
