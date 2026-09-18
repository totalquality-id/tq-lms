import { Download, ExternalLink } from "lucide-react";

import { archiveResourceAction, resourceAction } from "@/app/staff-actions";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { DialogForm } from "@/features/management/dialog-form";
import { resourceFields } from "@/features/management/staff-fields";
import { RESOURCE_MAX_BYTES, fileSize } from "@/lib/upload";
import { date } from "@/lib/utils";
import { batchResources } from "@/services/batch";
import { ACCEPTED_EXTENSIONS, storageConfigured } from "@/services/file";
import { ResourceUpload } from "./resource-upload";

export async function ManageResources({ id }: { id: string }) {
  const { batch } = await batchResources(id);
  const uploads = storageConfigured();

  return (
    <Card>
      <CardHeader
        title="Materi pendukung"
        description="Slide, template, dan dokumen tambahan yang dibagikan ke peserta kelas ini."
        action={
          <div className="flex flex-wrap gap-2">
            {uploads ? (
              <ResourceUpload
                batchId={id}
                accept={ACCEPTED_EXTENSIONS}
                maxBytes={RESOURCE_MAX_BYTES}
              />
            ) : null}
            <DialogForm
              action={resourceAction.bind(null, id)}
              title="Tambah tautan"
              fields={resourceFields()}
              triggerSize="sm"
              triggerVariant={uploads ? "secondary" : "primary"}
            />
          </div>
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
                  href={
                    resource.storageKey
                      ? `/api/files/resource/${resource.id}`
                      : resource.url
                  }
                  {...(resource.storageKey
                    ? {}
                    : { target: "_blank", rel: "noopener noreferrer" })}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900 hover:text-brand-700 hover:underline"
                >
                  {resource.title}
                  {resource.storageKey ? (
                    <Download className="size-3.5 text-ink-400" aria-hidden />
                  ) : (
                    <ExternalLink
                      className="size-3.5 text-ink-400"
                      aria-hidden
                    />
                  )}
                </a>
                <p className="mt-0.5 text-xs text-ink-500">
                  {resource.description || "Tanpa keterangan"} ·{" "}
                  {resource.storageKey
                    ? `Berkas ${fileSize(resource.size)}`
                    : "Tautan"}{" "}
                  · {date(resource.createdAt)}
                </p>
              </div>
              <ActionButton
                variant="ghost"
                size="sm"
                action={archiveResourceAction.bind(null, id, resource.id)}
                confirm={{
                  title: "Hapus materi dari daftar?",
                  description: resource.storageKey
                    ? "Materi dihapus dari halaman peserta. Berkasnya tetap tersimpan pada penyimpanan sehingga riwayat kelas yang sudah berjalan tidak berubah."
                    : "Tautan dihapus dari halaman peserta. Berkas di penyedia aslinya tidak ikut terhapus.",
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
          description="Unggah slide atau template agar peserta dapat mengunduhnya kapan saja."
        />
      )}
      <CardBody className="border-t border-ink-200">
        <p className="text-xs leading-relaxed text-ink-500">
          {uploads
            ? `Berkas yang diunggah (maksimum ${fileSize(RESOURCE_MAX_BYTES)}) tersimpan pada penyimpanan privat dan hanya dapat dibuka peserta kelas ini melalui tautan berumur pendek. Materi berupa tautan mengikuti pengaturan akses penyedianya sendiri.`
            : "Penyimpanan berkas belum dikonfigurasi pada lingkungan ini, jadi materi dibagikan sebagai tautan. Pastikan pengaturan akses pada penyedia tautan mengizinkan seluruh peserta membukanya."}
        </p>
      </CardBody>
    </Card>
  );
}
