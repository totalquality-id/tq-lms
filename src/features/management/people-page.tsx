import type { UserRole } from "@prisma/client";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { getPage, PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { EmptyState, Table, TableWrap, Td, Th } from "@/components/ui/table";
import { canAssignRole } from "@/lib/policy";
import { db } from "@/lib/db";
import { initials, labels } from "@/lib/utils";
import { requireAdmin } from "@/services/access";
import { ArchiveButton, EntityForm } from "./entity-form";
import { userFields } from "./fields";

const COPY: Record<string, { title: string; description: string }> = {
  TRAINER: {
    title: "Trainer",
    description: "Fasilitator yang membimbing kelas dan menilai peserta.",
  },
  PARTICIPANT: {
    title: "Peserta",
    description: "Karyawan klien dan peserta umum yang mengikuti pelatihan.",
  },
  ALL: {
    title: "Pengguna",
    description: "Seluruh akun beserta peran dan hak aksesnya.",
  },
};

export async function PeoplePage({
  role,
  searchParams,
}: {
  role?: UserRole;
  searchParams: Promise<{ q?: string; organizationId?: string; page?: string }>;
}) {
  const actor = await requireAdmin();
  const filters = await searchParams;
  const page = getPage(filters.page);
  const copy = COPY[role ?? "ALL"];

  const query = filters.q?.trim() ?? "";
  const where = {
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(filters.organizationId
      ? {
          memberships: {
            some: { organizationId: filters.organizationId },
          },
        }
      : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [people, total, organizations] = await Promise.all([
    db.user.findMany({
      where,
      include: { memberships: { include: { organization: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.count({ where }),
    db.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={
          <EntityForm
            entity="user"
            title={`Tambah ${copy.title.toLowerCase()}`}
            fields={userFields(
              organizations,
              actor.role === "SUPER_ADMIN",
              role,
            )}
            icon
          />
        }
      />
      <Card>
        <FilterBar
          q={filters.q}
          placeholder="Cari nama atau email…"
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
          ]}
        />
        {people.length ? (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th>Organisasi</Th>
                  {role ? null : <Th>Peran</Th>}
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Tindakan</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                          {initials(person.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-ink-900">
                            {person.name}
                          </p>
                          <p className="text-xs text-ink-500">
                            {person.email}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-sm">
                      {person.memberships
                        .map((member) => member.organization.name)
                        .join(", ") || (
                        <span className="text-ink-400">
                          Total Quality Indonesia
                        </span>
                      )}
                      {person.jobTitle ? (
                        <p className="text-xs text-ink-500">
                          {person.jobTitle}
                        </p>
                      ) : null}
                    </Td>
                    {role ? null : (
                      <Td className="text-sm whitespace-nowrap">
                        {labels[person.role] ?? person.role}
                      </Td>
                    )}
                    <Td>
                      <Badge tone={person.active ? "success" : "neutral"}>
                        {person.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </Td>
                    <Td>
                      {canAssignRole(actor.role, person.role) &&
                      person.id !== actor.id ? (
                        <div className="flex justify-end gap-1">
                          <EntityForm
                            entity="user"
                            id={person.id}
                            title="Edit pengguna"
                            buttonLabel="Edit"
                            size="sm"
                            fields={userFields(
                              organizations,
                              actor.role === "SUPER_ADMIN",
                              person.role,
                              person,
                            )}
                          />
                          {person.active ? (
                            <ArchiveButton
                              entity="user"
                              id={person.id}
                              label="Nonaktifkan"
                              description="Akun langsung kehilangan akses pada permintaan berikutnya. Riwayat pelatihannya tetap tersimpan."
                            />
                          ) : null}
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-ink-400">
                          —
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="Tidak ada pengguna yang cocok"
            description="Ubah kata pencarian atau tambahkan pengguna baru."
          />
        )}
        <Pagination
          total={total}
          page={page}
          params={{ q: filters.q, organizationId: filters.organizationId }}
        />
      </Card>
    </div>
  );
}
