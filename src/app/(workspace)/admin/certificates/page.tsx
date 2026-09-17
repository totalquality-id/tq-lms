import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { revokeCertificateAction } from "@/app/staff-actions";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { revokeFields } from "@/features/management/staff-fields";
import { db } from "@/lib/db";
import { date } from "@/lib/utils";
import { requireAdmin } from "@/services/access";

export const metadata: Metadata = { title: "Sertifikat" };

export default async function AdminCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    organizationId?: string;
    status?: string;
    year?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const page = getPage(filters.page);
  const year = Number(filters.year);

  const where: Prisma.CertificateWhereInput = {
    status: { not: "DRAFT" },
    ...(filters.status === "ISSUED" || filters.status === "REVOKED"
      ? { status: filters.status }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q, mode: "insensitive" } },
            {
              enrollment: {
                participant: {
                  name: { contains: filters.q, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {}),
    ...(filters.organizationId
      ? { enrollment: { batch: { organizationId: filters.organizationId } } }
      : {}),
    ...(Number.isInteger(year) && year > 2000
      ? {
          issuedAt: {
            gte: new Date(`${year}-01-01T00:00:00+07:00`),
            lt: new Date(`${year + 1}-01-01T00:00:00+07:00`),
          },
        }
      : {}),
  };

  const [certificates, total, organizations] = await Promise.all([
    db.certificate.findMany({
      where,
      include: {
        enrollment: {
          include: {
            participant: true,
            batch: { include: { course: true, organization: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.certificate.count({ where }),
    db.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, index) =>
    String(currentYear - index),
  );

  return (
    <div>
      <PageHeader
        title="Sertifikat"
        description="Seluruh sertifikat yang pernah diterbitkan beserta status keabsahannya."
      />
      <Card>
        <FilterBar
          q={filters.q}
          placeholder="Cari nomor sertifikat atau nama peserta…"
          filters={[
            {
              name: "organizationId",
              value: filters.organizationId,
              label: "Filter organisasi",
              anyLabel: "Semua organisasi",
              options: organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
              })),
            },
            {
              name: "status",
              value: filters.status,
              label: "Filter status",
              anyLabel: "Semua status",
              options: ["ISSUED", "REVOKED"],
            },
            {
              name: "year",
              value: filters.year,
              label: "Filter tahun",
              anyLabel: "Semua tahun",
              options: years.map((value) => ({ value, label: value })),
            },
          ]}
        />

        {certificates.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nomor</Th>
                  <Th>Peserta</Th>
                  <Th>Course</Th>
                  <Th>Organisasi</Th>
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
                      <Link
                        href={`/verify/${certificate.number}`}
                        target="_blank"
                        className="hover:text-brand-700 hover:underline"
                      >
                        {certificate.number}
                      </Link>
                    </Td>
                    <Td className="text-sm">
                      {certificate.enrollment.participant.name}
                    </Td>
                    <Td className="text-sm">
                      {certificate.enrollment.batch.course.title}
                    </Td>
                    <Td className="text-sm">
                      {certificate.enrollment.batch.organization?.name ?? "—"}
                    </Td>
                    <Td className="text-sm whitespace-nowrap">
                      {certificate.issuedAt ? date(certificate.issuedAt) : "—"}
                    </Td>
                    <Td>
                      <StatusBadge value={certificate.status} />
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="secondary" size="sm">
                          <a
                            href={`/api/certificates/${certificate.number}/pdf`}
                          >
                            PDF
                          </a>
                        </Button>
                        {certificate.status === "ISSUED" ? (
                          <DialogForm
                            action={revokeCertificateAction.bind(
                              null,
                              certificate.id,
                            )}
                            title="Cabut sertifikat"
                            description={`${certificate.number} akan ditandai tidak berlaku pada halaman verifikasi publik. Tindakan ini tidak dapat dibatalkan.`}
                            fields={revokeFields()}
                            trigger="Cabut"
                            triggerVariant="ghost"
                            triggerSize="sm"
                            submitLabel="Cabut sertifikat"
                          />
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Belum ada sertifikat"
            description="Sertifikat diterbitkan dari halaman training, setelah syarat kelulusan peserta terpenuhi."
          />
        )}

        <Pagination
          total={total}
          page={page}
          params={{
            q: filters.q,
            organizationId: filters.organizationId,
            status: filters.status,
            year: filters.year,
          }}
        />
      </Card>
    </div>
  );
}
