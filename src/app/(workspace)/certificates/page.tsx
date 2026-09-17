import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { db } from "@/lib/db";
import { date, dateRange } from "@/lib/utils";
import { requireRole } from "@/services/access";

export const metadata: Metadata = { title: "Sertifikat" };

export default async function CertificatesPage() {
  const user = await requireRole("PARTICIPANT");

  const certificates = await db.certificate.findMany({
    where: {
      status: { not: "DRAFT" },
      enrollment: { participantId: user.id, deletedAt: null },
    },
    include: {
      enrollment: { include: { batch: { include: { course: true } } } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Sertifikat"
        description="Sertifikat pelatihan yang telah diterbitkan atas nama Anda."
      />
      <Card>
        {certificates.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nomor</Th>
                  <Th>Pelatihan</Th>
                  <Th>Tanggal pelatihan</Th>
                  <Th>Terbit</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Tindakan</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((certificate) => (
                  <tr key={certificate.id}>
                    <Td className="tabular font-medium whitespace-nowrap text-ink-900">
                      {certificate.number}
                    </Td>
                    <Td className="text-sm">
                      {certificate.enrollment.batch.course.title}
                      <p className="text-xs text-ink-500">
                        {certificate.enrollment.batch.title}
                      </p>
                    </Td>
                    <Td className="text-sm whitespace-nowrap">
                      {dateRange(
                        certificate.enrollment.batch.startDate,
                        certificate.enrollment.batch.endDate,
                      )}
                    </Td>
                    <Td className="text-sm whitespace-nowrap">
                      {certificate.issuedAt ? date(certificate.issuedAt) : "—"}
                    </Td>
                    <Td>
                      <StatusBadge value={certificate.status} />
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {certificate.status === "ISSUED" ? (
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href={`/api/certificates/${certificate.number}/pdf`}
                          >
                            Unduh PDF
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-ink-500">Dicabut</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Belum ada sertifikat"
            description="Sertifikat terbit setelah Anda menyelesaikan seluruh syarat kelulusan pelatihan."
          />
        )}
      </Card>
    </div>
  );
}
