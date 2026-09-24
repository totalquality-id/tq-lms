"use client";

import Link from "@/components/ui/navigation-link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string; badge?: string | number };

/**
 * Tab berupa tautan, bukan state klien: setiap bagian training punya URL
 * sendiri sehingga dapat dibagikan, di-bookmark, dan dimuat di server.
 *
 * Bentuknya kendali tersegmen — tab aktif menjadi kepingan putih di atas alur
 * abu. Pada latar abu halaman, bentuk ini lebih terbaca daripada garis bawah,
 * dan tetap tenang karena warnanya hanya putih dan abu.
 *
 * Tab pertama (indeks halaman) hanya aktif pada kecocokan persis; tab lain
 * memiliki seluruh subtree-nya.
 */
export function TabNav({
  items,
  className,
}: {
  items: TabItem[];
  className?: string;
}) {
  const pathname = usePathname();
  const root = items[0]?.href;

  return (
    <nav
      className={cn("no-print mb-5 -mx-1 overflow-x-auto px-1 pb-1", className)}
    >
      <ul className="inline-flex min-w-max items-center gap-1 rounded-lg bg-ink-100 p-1">
        {items.map((item) => {
          const active =
            item.href === root
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-white font-semibold text-ink-900 shadow-[var(--shadow-card)]"
                    : "font-medium text-ink-500 hover:text-ink-800",
                )}
              >
                {item.label}
                {item.badge !== undefined && item.badge !== 0 ? (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-[11px] font-semibold",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "bg-ink-200 text-ink-600",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
