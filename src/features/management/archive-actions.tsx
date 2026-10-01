"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";

import { restoreAction, deleteAction } from "@/app/actions";
import type { ArchiveCategory } from "@/services/archive";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function RestoreButton({
  category,
  id,
  title,
}: {
  category: ArchiveCategory;
  id: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label={`Pulihkan ${title}`}
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Pulihkan
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Pulihkan data ini?"
        description={`"${title}" akan dikembalikan ke daftar aktif.`}
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await restoreAction(category, id);
                if (result.error) toast.error(result.error);
                else {
                  toast.success(result.success);
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Memproses…" : "Pulihkan"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function DeleteButton({
  category,
  id,
  title,
}: {
  category: ArchiveCategory;
  id: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="link"
        onClick={() => setOpen(true)}
        aria-label={`Hapus permanen ${title}`}
        className="text-red-600 hover:text-red-700"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Hapus
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Hapus permanen?"
        description={`"${title}" akan dihapus selamanya dan tidak dapat dikembalikan. Tindakan ini tidak dapat dibatalkan.`}
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await deleteAction(category, id);
                if (result.error) toast.error(result.error);
                else {
                  toast.success(result.success);
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Menghapus…" : "Hapus permanen"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
