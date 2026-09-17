import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { MobileNav } from "@/components/layout/app-nav";
import { UserMenu } from "@/components/layout/user-menu";
import type { NavGroup } from "@/lib/navigation";

export function AppHeader({
  user,
  groups,
  home,
}: {
  user: { name: string; email: string; roleLabel: string };
  groups: NavGroup[];
  home: string;
}) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        {/* Berada sebelum tanda perusahaan agar menu menjadi hal pertama yang
            dijangkau ibu jari pada ponsel, sesuai kebiasaan platform. */}
        <MobileNav groups={groups} />
        <Link href={home} className="min-w-0 rounded-md">
          <Brand />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <UserMenu
            name={user.name}
            email={user.email}
            roleLabel={user.roleLabel}
          />
        </div>
      </div>
    </header>
  );
}
