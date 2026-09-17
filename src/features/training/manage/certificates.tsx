import { issueCertificateAction } from "@/app/staff-actions";
import { ActionButton } from "@/components/ui/action-button";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { db } from "@/lib/db";
import { accessibleBatch } from "@/services/access";
import { checkEligibility, eligibilityInclude } from "@/services/certificate";

export async function ManageCertificates({ id }: { id: string }) {
  const { batch } = await accessibleBatch(id);

  const enrollments = await db.enrollment.findMany({
    where: { batchId: id, deletedAt: null, status: { not: "CANCELLED" } },
    include: eligibilityInclude,
    orderBy: { participant: { name: "asc" } },
  });

  if (!enrollments.length)
    return (
      <Card>
        <EmptyState
          title="Belum ada peserta"
          description="Sertifikat diterbitkan per peserta setelah syarat kelulusan terpenuhi."
        />
      </Card>
    );

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
            ? `${ready} peserta memenuhi syarat dan siap diterbitkan sertifikatnya.`
            : "Sertifikat terbit hanya ketika seluruh syarat kelulusan peserta terpenuhi."
        }
      />
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
              const { eligible, requirements } = checkEligibility(enrollment);
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
                      <span className="text-xs text-ink-400">Belum terbit</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {issued ? (
                      <Button asChild variant="secondary" size="sm">
                        <a href={`/api/certificates/${certificate.number}/pdf`}>
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
