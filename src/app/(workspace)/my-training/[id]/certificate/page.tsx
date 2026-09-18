import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { db } from "@/lib/db";
import { dateLong } from "@/lib/utils";
import { checkEligibility, eligibilityInclude } from "@/services/certificate";
import { myEnrollment } from "@/services/learning";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const summary = await myEnrollment(id);

  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: summary.id },
    include: eligibilityInclude,
  });
  const { requirements, eligible } = checkEligibility(enrollment);
  const certificate = enrollment.certificate;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Sertifikat pelatihan"
          description="Diterbitkan setelah seluruh syarat kelulusan terpenuhi dan diperiksa penyelenggara."
          action={
            certificate && certificate.status !== "DRAFT" ? (
              <StatusBadge value={certificate.status} />
            ) : null
          }
        />
        <CardBody className="space-y-4">
          {certificate?.status === "ISSUED" ? (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-ink-500">Nomor sertifikat</dt>
                  <dd className="tabular mt-0.5 text-sm font-medium text-ink-900">
                    {certificate.number}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Tanggal terbit</dt>
                  <dd className="mt-0.5 text-sm text-ink-800">
                    {certificate.issuedAt
                      ? dateLong(certificate.issuedAt)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={`/api/certificates/${certificate.number}/pdf`}>
                    Unduh PDF
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <a
                    href={`/verify/${certificate.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Halaman verifikasi
                  </a>
                </Button>
              </div>
            </>
          ) : certificate?.status === "REVOKED" ? (
            <Note>
              Sertifikat {certificate.number} telah dicabut. Hubungi
              administrator pelatihan untuk penjelasan.
            </Note>
          ) : (
            <Note>
              {eligible
                ? "Seluruh syarat sudah terpenuhi. Sertifikat akan diterbitkan setelah penyelenggara menutup training."
                : "Sertifikat belum dapat diterbitkan. Lengkapi syarat yang masih tertunda di bawah ini."}
            </Note>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Syarat kelulusan" />
        <ul className="divide-y divide-ink-100">
          {requirements.map((requirement) => (
            <li
              key={requirement.label}
              className="flex items-center gap-3 px-4 py-3 sm:px-5"
            >
              <span
                aria-hidden
                className={
                  requirement.met
                    ? "size-2 shrink-0 rounded-full bg-[var(--color-success)]"
                    : "size-2 shrink-0 rounded-full border border-ink-400"
                }
              />
              <span className="min-w-0 flex-1 text-sm text-ink-900">
                {requirement.label}
              </span>
              <span className="text-xs text-ink-500">{requirement.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
