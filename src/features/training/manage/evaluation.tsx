import { evaluationAction } from "@/app/staff-actions";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Note } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/table";
import { batchEvaluation } from "@/services/batch";
import { evaluationSummary } from "@/services/operations";

/** Bilah rata-rata 1–5 dengan angkanya, tanpa grafik yang perlu ditafsirkan. */
function RatingRow({
  text,
  category,
  average,
}: {
  text: string;
  category: string;
  average: number;
}) {
  const percent = (average / 5) * 100;
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 text-sm text-ink-800">{text}</p>
        <span className="tabular text-sm font-medium text-ink-900">
          {average ? average.toFixed(2) : "—"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-500">{category}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
        <div
          className="h-full rounded-full bg-brand-600"
          style={{ width: `${percent}%` }}
        />
      </div>
    </li>
  );
}

export async function ManageEvaluation({ id }: { id: string }) {
  const { batch } = await batchEvaluation(id);
  const summary = await evaluationSummary(id);

  if (!batch.evaluation)
    return (
      <Card>
        <CardHeader
          title="Evaluasi pelatihan"
          description="Formulir baku Total Quality: materi, trainer, penyelenggaraan, fasilitas, dan kepuasan keseluruhan."
        />
        <CardBody>
          <EmptyState
            title="Evaluasi belum dibuka"
            description="Buka evaluasi menjelang akhir pelatihan agar peserta dapat memberi masukan sebelum kelas ditutup."
            action={
              <ActionButton action={evaluationAction.bind(null, id, true)}>
                Buka evaluasi
              </ActionButton>
            }
          />
        </CardBody>
      </Card>
    );

  const participants = batch._count.enrollments;
  const responseRate = participants
    ? Math.round(((summary?.responses ?? 0) / participants) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Evaluasi pelatihan"
          description={`${summary?.responses ?? 0} dari ${participants} peserta mengisi (${responseRate}%)`}
          action={
            batch.evaluation.open ? (
              <ActionButton
                variant="secondary"
                size="sm"
                action={evaluationAction.bind(null, id, false)}
                confirm={{
                  title: "Tutup evaluasi?",
                  description:
                    "Peserta yang belum mengisi tidak dapat lagi mengirim masukan. Evaluasi dapat dibuka kembali.",
                }}
                confirmLabel="Tutup"
              >
                Tutup evaluasi
              </ActionButton>
            ) : (
              <ActionButton
                size="sm"
                action={evaluationAction.bind(null, id, true)}
              >
                Buka kembali
              </ActionButton>
            )
          }
        />
        <CardBody>
          {summary && summary.responses > 0 ? (
            <p className="text-sm text-ink-700">
              Rata-rata keseluruhan{" "}
              <span className="tabular font-semibold text-ink-900">
                {summary.average.toFixed(2)}
              </span>{" "}
              dari 5.
            </p>
          ) : (
            <Note>
              Belum ada peserta yang mengisi evaluasi. Rekap muncul setelah
              jawaban pertama masuk.
            </Note>
          )}
        </CardBody>
      </Card>

      {summary && summary.responses > 0 ? (
        <>
          <Card>
            <CardHeader title="Rata-rata per pernyataan" />
            <ul className="divide-y divide-ink-100">
              {summary.ratings.map((rating) => (
                <RatingRow
                  key={rating.id}
                  text={rating.text}
                  category={rating.category}
                  average={rating.average}
                />
              ))}
            </ul>
          </Card>

          {summary.comments.length ? (
            <Card>
              <CardHeader
                title="Masukan tertulis"
                description="Ditampilkan tanpa identitas penulis."
              />
              <ul className="divide-y divide-ink-100">
                {summary.comments.map((comment, index) => (
                  <li
                    key={index}
                    className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-ink-700 sm:px-5"
                  >
                    {comment}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
