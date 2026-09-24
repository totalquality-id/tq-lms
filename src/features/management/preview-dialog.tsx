"use client";

import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function PreviewDialog({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Eye aria-hidden /> Preview
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Preview · ${title}`}
        description="Tampilan peserta. Isian dapat dicoba; jawaban, unggahan, dan progres tidak disimpan."
      >
        {children}
      </Dialog>
    </>
  );
}
