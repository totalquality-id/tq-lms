"use client";

import { DropdownMenu } from "radix-ui";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import Link from "@/components/ui/navigation-link";
import { useRef } from "react";

import { logout } from "@/app/auth-actions";
import { initials } from "@/lib/utils";

export function UserMenu({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email: string;
  roleLabel: string;
}) {
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      {/*
        Formulir keluar sengaja berada di luar portal dropdown: portal dilepas
        begitu sebuah item dipilih, yang akan mencabut formulir dari dokumen
        sebelum peramban sempat mengirimkannya.
      */}
      <form ref={signOutForm} action={logout} hidden />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-ink-100">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials(name)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-40 truncate text-sm font-medium text-ink-800">
              {name}
            </span>
            <span className="block text-xs text-ink-500">{roleLabel}</span>
          </span>
          <ChevronDown className="size-4 text-ink-400" aria-hidden />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 w-60 rounded-md border border-ink-200 bg-white p-1 shadow-[var(--shadow-overlay)]"
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium text-ink-800">
                {name}
              </p>
              <p className="truncate text-xs text-ink-500">{email}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-ink-200" />
            <DropdownMenu.Item asChild>
              <Link
                href="/profile"
                className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm text-ink-700 outline-none hover:bg-ink-100 focus:bg-ink-100"
              >
                <UserIcon className="size-4" aria-hidden />
                Profil saya
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-ink-200" />
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm text-ink-700 outline-none hover:bg-ink-100 focus:bg-ink-100"
              onSelect={(event) => {
                event.preventDefault();
                signOutForm.current?.requestSubmit();
              }}
            >
              <LogOut className="size-4" aria-hidden />
              Keluar
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
