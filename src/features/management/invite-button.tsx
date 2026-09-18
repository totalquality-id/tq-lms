"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { inviteAction, type InviteState } from "@/app/account-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Note } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { dateTime } from "@/lib/utils";

/**
 * Menyiapkan akun lalu memperlihatkan tautan sekali pakai. Tautannya tetap
 * ditampilkan penuh meski surel sudah terkirim: surel dapat tertahan penyaring
 * sampah, dan administrator yang sudah memegang tautannya tidak perlu
 * menerbitkan tautan baru — yang lama akan ikut terbatalkan — hanya untuk
 * menolong satu orang yang tidak menerimanya.
 */
export function InviteButton({
  userId,
  name,
  activated,
  pending: outstanding,
}: {
  userId: string;
  name: string;
  /** Akun sudah punya identitas di penyedia autentikasi. */
  activated: boolean;
  pending?: "INVITE" | "RESET";
}) {
  const [busy, start] = useTransition();
  const [result, setResult] = useState<InviteState | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // Label menyebut akibat menekannya, bukan keadaan akunnya. Akun yang sudah
  // aktif hanya bisa disetel ulang — menyebutnya "Undang" akan menyesatkan.
  const label = outstanding
    ? "Tautan baru"
    : activated
      ? "Reset kata sandi"
      : "Undang";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const state = await inviteAction(userId);
            if (state.error) {
              toast.error(state.error);
              return;
            }
            setCopied(false);
            setResult(state);
            router.refresh();
          })
        }
      >
        {busy ? "Menyiapkan…" : label}
      </Button>

      <Dialog
        open={Boolean(result?.invitation)}
        onOpenChange={(open) => {
          if (!open) setResult(null);
        }}
        title={
          result?.invitation?.purpose === "INVITE"
            ? "Tautan undangan"
            : "Tautan penyetelan ulang"
        }
        description={`Untuk ${name}. Berlaku sekali pakai.`}
      >
        {result?.invitation ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                readOnly
                value={result.invitation.url}
                aria-label="Tautan sekali pakai"
                className="font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.invitation!.url);
                    setCopied(true);
                    toast.success("Tautan disalin.");
                  } catch {
                    // Papan klip dapat diblokir oleh izin peramban; kolomnya
                    // tetap dapat dipilih dan disalin manual.
                    toast.error("Salin manual dari kolom di samping.");
                  }
                }}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Tersalin" : "Salin"}
              </Button>
            </div>

            <Note>
              {result.invitation.sent
                ? `Tautan sudah dikirim ke ${result.invitation.email}. `
                : null}
              Berlaku sampai {dateTime(result.invitation.expiresAt)} dan hanya
              dapat dipakai sekali. Teruskan melalui saluran yang Anda percaya —
              siapa pun yang memegang tautan ini dapat menetapkan kata sandi
              akun tersebut.
            </Note>

            <p className="text-xs leading-relaxed text-ink-500">
              Tautan tidak dapat ditampilkan ulang setelah dialog ini ditutup.
              Bila hilang, buat tautan baru — yang lama otomatis dibatalkan.
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
