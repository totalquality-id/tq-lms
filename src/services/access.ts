import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { auth, demoEnabled } from "@/lib/auth";
import { db } from "@/lib/db";
import { home, isAdmin } from "@/lib/policy";

export const currentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findFirst({
    where: { id: session.user.id, active: true, deletedAt: null },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user || (user.isDemo && !demoEnabled())) redirect("/login");
  return {
    ...user,
    organizationIds: user.memberships
      .filter((member) => member.isPic && !member.organization.deletedAt)
      .map((member) => member.organizationId),
  };
});

export async function requireRole(...roles: UserRole[]) {
  const user = await currentUser();
  if (!roles.includes(user.role)) redirect(home(user.role));
  return user;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!isAdmin(user.role))
    throw new Error("Anda tidak memiliki akses administrator.");
  return user;
}

/**
 * Wewenang mengelola satu training: administrator, atau trainer yang memang
 * ditugaskan pada kelas itu. Diperiksa dengan query, bukan dengan menyaring
 * hasil di memori, sehingga id yang ditebak tetap berakhir di 404.
 */
export async function requireBatchStaff(batchId: string) {
  const user = await currentUser();
  const batch = await db.trainingBatch.findFirst({
    where: {
      id: batchId,
      deletedAt: null,
      ...(isAdmin(user.role)
        ? {}
        : { trainers: { some: { trainerId: user.id } } }),
    },
  });
  if (!batch) notFound();
  return { user, batch, admin: isAdmin(user.role) };
}

/**
 * Pemuat data satu training tidak tinggal di sini. Setiap tab pengelolaan
 * menyatakan sendiri apa yang dibacanya di `services/batch.ts`; berkas ini
 * hanya menjawab siapa yang boleh membacanya.
 */
