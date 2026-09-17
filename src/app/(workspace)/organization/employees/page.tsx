import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { db } from "@/lib/db";
import { requireRole } from "@/services/access";

export const metadata: Metadata = { title: "Karyawan" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireRole("CORPORATE_PIC");
  const filters = await searchParams;
  const page = getPage(filters.page);
  const organizationIds = user.organizationIds;

  const where = {
    role: "PARTICIPANT" as const,
    deletedAt: null,
    memberships: { some: { organizationId: { in: organizationIds } } },
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" as const } },
            { email: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [people, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        enrollments: {
          where: {
            deletedAt: null,
            status: { not: "CANCELLED" },
            batch: { organizationId: { in: organizationIds } },
          },
          select: { status: true, certificate: { select: { status: true } } },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Karyawan"
        description="Karyawan organisasi Anda dan rekam pelatihannya."
      />
      <Card>
        <FilterBar q={filters.q} placeholder="Cari nama atau email…" />
        {people.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Karyawan</Th>
                  <Th>Jabatan</Th>
                  <Th className="text-right">Training diikuti</Th>
                  <Th className="text-right">Selesai</Th>
                  <Th className="text-right">Sertifikat</Th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <Td>
                      <p className="font-medium text-ink-900">{person.name}</p>
                      <p className="text-xs text-ink-500">{person.email}</p>
                    </Td>
                    <Td className="text-sm">{person.jobTitle || "—"}</Td>
                    <Td className="tabular text-right text-sm">
                      {person.enrollments.length}
                    </Td>
                    <Td className="tabular text-right text-sm">
                      {
                        person.enrollments.filter(
                          (enrollment) => enrollment.status === "COMPLETED",
                        ).length
                      }
                    </Td>
                    <Td className="tabular text-right text-sm">
                      {
                        person.enrollments.filter(
                          (enrollment) =>
                            enrollment.certificate?.status === "ISSUED",
                        ).length
                      }
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Belum ada karyawan"
            description="Administrator Total Quality Indonesia dapat menambahkan karyawan ke organisasi Anda."
          />
        )}
        <Pagination total={total} page={page} params={{ q: filters.q }} />
      </Card>
    </div>
  );
}
