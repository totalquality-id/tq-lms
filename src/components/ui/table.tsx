import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Membungkus tabel agar isi lebar bergulir di dalam kartu, bukan halaman. */
export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full min-w-full border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-ink-200 bg-ink-50 px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-ink-600 uppercase whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "border-b border-ink-100 px-4 py-3 align-middle text-ink-700",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
