import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { ProfileForm } from "@/features/management/entity-form";
import { initials, labels } from "@/lib/utils";
import { currentUser } from "@/services/access";

export const metadata: Metadata = { title: "Profil saya" };

export default async function ProfilePage() {
  const user = await currentUser();
  const organizations = user.memberships
    .map((member) => member.organization.name)
    .join(", ");

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Profil saya"
        description="Informasi pribadi yang tampil pada daftar peserta dan sertifikat."
      />

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {initials(user.name)}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  {user.name}
                </span>
                <span className="block text-xs font-normal text-ink-500">
                  {user.email} · {labels[user.role] ?? user.role}
                  {organizations ? ` · ${organizations}` : ""}
                </span>
              </span>
            </span>
          }
        />
        <CardBody className="space-y-4">
          <ProfileForm name={user.name} jobTitle={user.jobTitle ?? ""} />
          <Note>
            Email, peran, dan organisasi dikelola administrator. Hubungi
            administrator pelatihan bila ada yang perlu diperbaiki.
          </Note>
        </CardBody>
      </Card>
    </div>
  );
}
