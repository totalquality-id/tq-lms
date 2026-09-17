import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-ink-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-500 aria-[invalid=true]:border-danger";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23697687' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-24 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(fieldBase, "h-10 appearance-none pr-9", className)}
      style={{
        backgroundImage: CHEVRON,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.625rem center",
      }}
      {...props}
    />
  );
}
