"use client";

import { DropdownMenu } from "radix-ui";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markAllReadAction, markReadAction } from "@/app/notification-actions";
import type { NotificationPanel } from "@/services/notification";
import { dateTime } from "@/lib/utils";

/**
 * Bel pemberitahuan pada kepala halaman.
 *
 * Isinya dibaca di server pada setiap permintaan, bukan dijaring berkala dari
 * peramban: kabar yang ditampilkan di sini menyusul mutasi yang sudah
 * dilakukan orang lain, dan menunggu sampai halaman berikutnya dibuka adalah
 * penundaan yang dapat diterima — sedangkan satu permintaan tiap beberapa
 * detik dari setiap tab yang terbuka tidak.
 */
export function NotificationBell({ unread, items }: NotificationPanel) {
  const router = useRouter();
  const [busy, start] = useTransition();

  const open = (id: string, href: string | null, read: boolean) => {
    start(async () => {
      if (!read) await markReadAction(id);
      if (href) router.push(href);
      else router.refresh();
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="relative grid size-9 place-items-center rounded-md text-ink-600 hover:bg-ink-100"
        aria-label={
          unread ? `Pemberitahuan, ${unread} belum dibaca` : "Pemberitahuan"
        }
      >
        <Bell className="size-5" aria-hidden />
        {unread ? (
          <span
            aria-hidden
            className="tabular absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-80 overflow-hidden rounded-md border border-ink-200 bg-white shadow-[var(--shadow-overlay)] sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-3 py-2.5">
            <p className="text-sm font-medium text-ink-800">Pemberitahuan</p>
            {unread ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  start(async () => void (await markAllReadAction()))
                }
                className="rounded text-xs font-medium text-brand-700 hover:underline disabled:text-ink-400"
              >
                Tandai semua terbaca
              </button>
            ) : null}
          </div>

          {items.length ? (
            <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <DropdownMenu.Item
                    onSelect={() => open(item.id, item.href, item.read)}
                    className="flex cursor-pointer gap-2.5 px-3 py-3 outline-none hover:bg-ink-50 focus:bg-ink-50"
                  >
                    <span
                      aria-hidden
                      className={
                        item.read
                          ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-transparent"
                          : "mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-900">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-600">
                        {item.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-ink-400">
                        {dateTime(item.createdAt)}
                      </span>
                    </span>
                  </DropdownMenu.Item>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-ink-500">
              Belum ada pemberitahuan.
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
