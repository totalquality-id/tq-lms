"use client";

import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay
          data-overlay=""
          className="fixed inset-0 z-50 bg-ink-900/40"
        />
        <Primitive.Content
          data-dialog-panel=""
          className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-card)] border border-ink-200 bg-white shadow-[var(--shadow-overlay)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div className="min-w-0">
              <Primitive.Title className="text-base font-semibold text-ink-900">
                {title}
              </Primitive.Title>
              <Primitive.Description className="mt-0.5 text-xs text-ink-500">
                {description ?? "Lengkapi informasi di bawah ini."}
              </Primitive.Description>
            </div>
            <Primitive.Close
              className="grid size-8 shrink-0 place-items-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              aria-label="Tutup"
            >
              <X className="size-4" aria-hidden />
            </Primitive.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
