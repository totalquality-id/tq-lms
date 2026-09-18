import Link from "next/link";

import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card, StatCard } from "@/components/ui/card";
import { TrainingTable } from "@/features/training/training-table";
import { db } from "@/lib/db";
import { batchScope } from "@/lib/policy";
import { trainingInclude } from "@/repositories/training";
import { requireRole } from "@/services/access";

export default async function OrganizationDashboard() {
  const user = await requireRole("CORPORATE_PIC");
  const scope = batchScope(user);
  const organizationIds = user.organizationIds;

  const [employees, ongoing, completed, certificates, recent] =
    await Promise.all([
      db.user.count({
        where: {
          role: "PARTICIPANT",
          deletedAt: null,
          memberships: { some: { organizationId: { in: organizationIds } } },
        },
      }),
      db.trainingBatch.count({
        where: { AND: [scope, { status: { in: ["ONGOING", "OPEN"] } }] },
      }),
      db.trainingBatch.count({
        where: { AND: [scope, { status: "COMPLETED" }] },
      }),
      db.certificate.count({
        where: {
          status: "ISSUED",
          enrollment: {
            batch: { organizationId: { in: organizationIds } },
          },
        },
      }),
      db.trainingBatch.findMany({
        where: scope,
        include: trainingInclude,
        orderBy: { startDate: "desc" },
        take: 6,
      }),
    ]);

  const organizations = user.memberships
    .filter((member) => member.isPic)
    .map((member) => member.organization.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard perusahaan"
        description={organizations.join(", ") || "Organisasi belum ditetapkan."}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Karyawan terdaftar" value={employees} />
        <StatCard label="Training berjalan" value={ongoing} />
        <StatCard label="Training selesai" value={completed} />
        <StatCard label="Sertifikat terbit" value={certificates} />
      </div>

      <section>
        <SectionHeader
          title="Training perusahaan"
          description="Pelatihan yang diselenggarakan untuk organisasi Anda."
          href="/organization/training"
        />
        <Card>
          <TrainingTable
            items={recent}
            base="/organization/training"
            showOrganization={false}
            empty="Belum ada training"
            emptyDescription="Training akan tampil di sini setelah dijadwalkan bersama Total Quality Indonesia."
          />
        </Card>
      </section>

      <p className="text-xs leading-relaxed text-ink-500">
        Data yang ditampilkan terbatas pada organisasi Anda. Untuk menambah
        peserta atau menjadwalkan pelatihan baru, hubungi administrator
        pelatihan melalui{" "}
        <Link href="/profile" className="text-brand-600 hover:underline">
          kontak pada profil Anda
        </Link>
        .
      </p>
    </div>
  );
}
