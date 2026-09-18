import { Download, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/table";
import { fileSize } from "@/lib/upload";
import { date } from "@/lib/utils";
import { myEnrollment } from "@/services/learning";

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const enrollment = await myEnrollment(id);
  const { resources } = enrollment.batch;

  if (!resources.length)
    return (
      <Card>
        <EmptyState
          title="Belum ada materi pendukung"
          description="Slide, template, dan dokumen tambahan akan dibagikan trainer di sini."
        />
      </Card>
    );

  return (
    <Card>
      <ul className="divide-y divide-ink-100">
        {resources.map((resource) => (
          <li key={resource.id}>
            <a
              href={
                resource.storageKey
                  ? `/api/files/resource/${resource.id}`
                  : resource.url
              }
              {...(resource.storageKey
                ? {}
                : { target: "_blank", rel: "noopener noreferrer" })}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-ink-50 sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {resource.title}
                </span>
                <span className="block text-xs text-ink-500">
                  {resource.description || "Dibagikan trainer"} ·{" "}
                  {resource.storageKey
                    ? `Berkas ${fileSize(resource.size)}`
                    : "Tautan"}{" "}
                  · {date(resource.createdAt)}
                </span>
              </span>
              {resource.storageKey ? (
                <Download
                  className="size-4 shrink-0 text-ink-400"
                  aria-hidden
                />
              ) : (
                <ExternalLink
                  className="size-4 shrink-0 text-ink-400"
                  aria-hidden
                />
              )}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
