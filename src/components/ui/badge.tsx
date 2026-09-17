import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn, labels } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-ink-100 text-ink-700",
        info: "bg-brand-50 text-brand-700",
        success: "bg-[var(--color-success-bg)] text-[var(--color-success)]",
        warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
        danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/**
 * Nada setiap status dipusatkan di sini supaya satu status selalu tampil sama
 * di seluruh aplikasi, apa pun halamannya.
 */
const TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  OPEN: "info",
  ONGOING: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  INVITED: "warning",
  ENROLLED: "info",
  IN_PROGRESS: "info",
  PRESENT: "success",
  LATE: "warning",
  EXCUSED: "neutral",
  ABSENT: "danger",
  NOT_SUBMITTED: "neutral",
  SUBMITTED: "info",
  REVIEWED: "success",
  REVISION_REQUIRED: "warning",
  ISSUED: "success",
  REVOKED: "danger",
  PASSED: "success",
  FAILED: "danger",
  PENDING: "warning",
  PUBLISHED: "success",
};

export function StatusBadge({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <Badge tone={TONES[value] ?? "neutral"} className={className}>
      {labels[value] ?? value}
    </Badge>
  );
}
