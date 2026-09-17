"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string; badge?: string | number };

/**
 * Tab berupa tautan, bukan state klien: setiap bagian training punya URL
 * sendiri sehingga dapat dibagikan, di-bookmark, dan dimuat di server.
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
      className={cn(
        "no-print -mx-4 mb-5 overflow-x-auto border-b border-ink-200 px-4 sm:mx-0 sm:px-0",
        className,
      )}
    >
      <ul className="flex min-w-max gap-1">
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
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-brand-600 font-semibold text-brand-700"
                    : "border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900",
                )}
              >
                {item.label}
                {item.badge !== undefined && item.badge !== 0 ? (
                  <span className="tabular rounded-full bg-ink-100 px-1.5 text-xs font-medium text-ink-600">
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
