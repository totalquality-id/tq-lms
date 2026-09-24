"use client";

import NextLink, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
import { LoadingIndicator } from "./loading-indicator";

// Status resmi Next.js mencakup penantian sebelum fallback halaman tersedia.
// Klik tab baru, unduhan, dan tautan eksternal tetap ditangani oleh NextLink.
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? createPortal(<LoadingIndicator />, document.body) : null;
}

export default function NavigationLink({
  children,
  ...props
}: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {children}
      <PendingIndicator />
    </NextLink>
  );
}
