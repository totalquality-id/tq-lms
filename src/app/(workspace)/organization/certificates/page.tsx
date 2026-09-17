import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { db } from "@/lib/db";
import { date } from "@/lib/utils";
import { requireRole } from "@/services/access";

export const metadata: Metadata = { title: "Sertifikat" };

export default async function OrganizationCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireRole("CORPORATE_PIC");
  const filters = await searchParams;
  const page = getPage(filters.page);

  const where = {
    status: { not: "DRAFT" as const },
    enrollment: {
      deletedAt: null,
      batch: { organizationId: { in: user.organizationIds } },
      ...(filters.q
        ? {
            participant: {
              name: { contains: filters.q, mode: "insensitive" as const },
            },
          }
        : {}),
    },
  };

  const [certificates, total] = await Promise.all([
    db.certificate.findMany({
      where,
      include: {
        enrollment: {
          include: {
            participant: { select: { name: true, jobTitle: true } },
            batch: { include: { course: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.certificate.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Sertifikat"
        description="Sertifikat karyawan organisasi Anda."
      />
      <Card>
        <FilterBar q={filters.q} placeholder="Cari nama karyawan…" />
        {certificates.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nomor</Th>
                  <Th>Karyawan</Th>
                  <Th>Course</Th>
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
                    <Td className="tabular text-sm font-medium whitespace-nowrap text-ink-900">
                      {certificate.number}
                    </Td>
                    <Td>
                      <p className="text-sm text-ink-900">
                        {certificate.enrollment.participant.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {certificate.enrollment.participant.jobTitle || "—"}
                      </p>
                    </Td>
                    <Td className="text-sm">
                      {certificate.enrollment.batch.course.title}
                    </Td>
                    <Td className="text-sm whitespace-nowrap">
                      {certificate.issuedAt ? date(certificate.issuedAt) : "—"}
                    </Td>
                    <Td>
                      <StatusBadge value={certificate.status} />
                    </Td>
                    <Td className="text-right">
                      {certificate.status === "ISSUED" ? (
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href={`/api/certificates/${certificate.number}/pdf`}
                          >
                            Unduh PDF
                          </a>
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Belum ada sertifikat"
            description="Sertifikat karyawan akan tampil di sini setelah pelatihan selesai dan syarat kelulusannya terpenuhi."
          />
        )}
        <Pagination total={total} page={page} params={{ q: filters.q }} />
      </Card>
    </div>
  );
}
