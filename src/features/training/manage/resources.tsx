import { ExternalLink } from "lucide-react";

import { archiveResourceAction, resourceAction } from "@/app/staff-actions";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { resourceFields } from "@/features/management/staff-fields";
import { date } from "@/lib/utils";
import { accessibleBatch } from "@/services/access";

export async function ManageResources({ id }: { id: string }) {
  const { batch } = await accessibleBatch(id);

  return (
    <Card>
      <CardHeader
        title="Materi pendukung"
        description="Slide, template, dan dokumen tambahan yang dibagikan ke peserta kelas ini."
        action={
          <DialogForm
            action={resourceAction.bind(null, id)}
            title="Tambah materi"
            fields={resourceFields()}
            triggerSize="sm"
          />
        }
      />
      {batch.resources.length ? (
        <ul className="divide-y divide-ink-100">
          {batch.resources.map((resource) => (
            <li
              key={resource.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900 hover:text-brand-700 hover:underline"
                >
                  {resource.title}
                  <ExternalLink className="size-3.5 text-ink-400" aria-hidden />
                </a>
                <p className="mt-0.5 text-xs text-ink-500">
                  {resource.description || "Tanpa keterangan"} ·{" "}
                  {date(resource.createdAt)}
                </p>
              </div>
              <ActionButton
                variant="ghost"
                size="sm"
                action={archiveResourceAction.bind(null, id, resource.id)}
                confirm={{
                  title: "Hapus materi dari daftar?",
                  description:
                    "Tautan dihapus dari halaman peserta. Berkas di penyedia aslinya tidak ikut terhapus.",
                }}
                confirmLabel="Hapus"
              >
                Hapus
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Belum ada materi pendukung"
          description="Tambahkan tautan slide atau template agar peserta dapat mengunduhnya kapan saja."
        />
      )}
      <CardBody className="border-t border-ink-200">
        <p className="text-xs leading-relaxed text-ink-500">
          Materi dibagikan sebagai tautan. Pastikan pengaturan akses pada
          penyedia tautan mengizinkan seluruh peserta membukanya.
        </p>
      </CardBody>
    </Card>
  );
}
