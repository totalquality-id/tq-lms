"use client";

import { Dialog } from "radix-ui";
import {
  Award,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquareQuote,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "@/components/ui/navigation-link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/layout/brand";
import type { NavGroup, NavIcon, Workspace } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  course: GraduationCap,
  training: ClipboardList,
  participants: Users,
  trainer: UserCog,
  organization: Building2,
  question: ListChecks,
  evaluation: MessageSquareQuote,
  certificate: Award,
  report: FileBarChart,
  users: ShieldCheck,
  profile: UserRound,
  review: ClipboardCheck,
  history: Award,
};

/**
 * Sebuah tujuan memiliki seluruh subtree-nya, sehingga `/admin/training/abc`
 * tetap menyorot "Training". Halaman akar setiap peran adalah pengecualian:
 * awalannya cocok dengan semua hal, jadi hanya kecocokan persis yang aktif.
 */
function isActive(pathname: string, href: string, roots: Set<string>): boolean {
  if (roots.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  // Item pertama pada grup pertama selalu dashboard peran yang bersangkutan.
  const roots = new Set<string>(
    groups[0]?.items[0] ? [groups[0].items[0].href] : [],
  );

  return (
    <nav aria-label="Navigasi utama" className="space-y-6 py-2">
      {groups.map((group, index) => (
        <div key={group.caption ?? index} className="space-y-0.5">
          {group.caption ? (
            <p className="px-5 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">
              {group.caption}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href, roots);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // Baris selebar rel dengan penanda tipis di tepi kiri:
                  // posisi aktif terbaca sekilas tanpa blok warna besar.
                  "relative flex items-center gap-3 px-5 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-brand-50 font-semibold text-brand-700 before:absolute before:inset-y-1 before:left-0 before:w-0.75 before:rounded-r before:bg-brand-500"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                <Icon
                  className={cn(
                    "size-4.5 shrink-0",
                    active ? "text-brand-600" : "text-ink-400",
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Kepala sidebar: menyebut ruang kerja mana yang sedang dibuka pembaca. */
function WorkspaceHeader({ workspace }: { workspace: Workspace }) {
  return (
    <div className="border-b border-ink-200 px-5 py-4">
      <p className="text-base font-semibold text-ink-900">{workspace.name}</p>
      <p className="mt-0.5 text-xs text-ink-500">{workspace.caption}</p>
    </div>
  );
}

/** Rel tetap pada layar besar. Bergulir terpisah dari halaman. */
export function AppSidebar({
  groups,
  workspace,
}: {
  groups: NavGroup[];
  workspace: Workspace;
}) {
  const pathname = usePathname();

  return (
    <aside className="no-print sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 self-start overflow-y-auto border-r border-ink-200 bg-white lg:block">
      <WorkspaceHeader workspace={workspace} />
      <NavList groups={groups} pathname={pathname} />
    </aside>
  );
}

/**
 * Di bawah `lg` daftar yang sama pindah ke laci selebar layar, agar setiap
 * baris tetap lebar dan berada dalam jangkauan ibu jari.
 */
export function MobileNav({
  groups,
  workspace,
}: {
  groups: NavGroup[];
  workspace: Workspace;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Menutup pada setiap perubahan path — bukan hanya saat menekan tautan —
  // sekaligus menangani tombol maju dan mundur peramban.
  if (open && openedAt !== pathname) setOpen(false);
  if (openedAt !== pathname) setOpenedAt(pathname);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="grid size-10 shrink-0 place-items-center rounded-md text-ink-600 hover:bg-ink-100 hover:text-ink-900 lg:hidden"
        aria-label="Buka navigasi"
      >
        <Menu className="size-5" aria-hidden />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          data-overlay=""
          className="fixed inset-0 z-50 bg-ink-900/40 lg:hidden"
        />
        <Dialog.Content
          data-nav-panel=""
          className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white lg:hidden"
        >
          <Dialog.Title className="sr-only">Navigasi</Dialog.Title>
          <Dialog.Description className="sr-only">
            Daftar halaman TQ Learning yang dapat Anda buka.
          </Dialog.Description>

          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink-200 px-4 pt-safe">
            <Brand />
            <Dialog.Close
              className="grid size-10 shrink-0 place-items-center rounded-md text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              aria-label="Tutup navigasi"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto pb-safe">
            <WorkspaceHeader workspace={workspace} />
            <NavList
              groups={groups}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
