import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { ArchiveButton, EntityForm } from "@/features/management/entity-form";
import { orgFields } from "@/features/management/fields";
import { db } from "@/lib/db";
import { requireAdmin } from "@/services/access";

export const metadata: Metadata = { title: "Organisasi" };

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const page = getPage(filters.page);

  const where = {
    deletedAt: null,
    name: { contains: filters.q ?? "", mode: "insensitive" as const },
  };

  const [organizations, total] = await Promise.all([
    db.organization.findMany({
      where,
      include: { _count: { select: { members: true, batches: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.organization.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Organisasi"
        description="Perusahaan klien beserta karyawan dan riwayat pelatihannya."
        action={
          <EntityForm
            entity="organization"
            title="Tambah organisasi"
            fields={orgFields()}
            icon
          />
        }
      />
      <Card>
        <FilterBar q={filters.q} placeholder="Cari nama organisasi…" />
        {organizations.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Organisasi</Th>
                  <Th>Industri</Th>
                  <Th className="text-right">Anggota</Th>
                  <Th className="text-right">Training</Th>
                  <Th>
                    <span className="sr-only">Tindakan</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id}>
                    <Td>
                      <p className="font-medium text-ink-900">
                        {organization.name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {organization.email || "Email belum ditambahkan"}
                      </p>
                    </Td>
                    <Td className="text-sm">{organization.industry || "—"}</Td>
                    <Td className="tabular text-right text-sm">
                      {organization._count.members}
                    </Td>
                    <Td className="tabular text-right text-sm">
                      {organization._count.batches}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <EntityForm
                          entity="organization"
                          id={organization.id}
                          title="Edit organisasi"
                          buttonLabel="Edit"
                          size="sm"
                          fields={orgFields(organization)}
                        />
                        <ArchiveButton
                          entity="organization"
                          id={organization.id}
                          description="Organisasi disembunyikan dari daftar. Riwayat pelatihannya tetap tersimpan."
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Belum ada organisasi"
            description="Tambahkan perusahaan klien untuk mengelola pelatihan korporatnya."
          />
        )}
        <Pagination total={total} page={page} params={{ q: filters.q }} />
      </Card>
    </div>
  );
}
