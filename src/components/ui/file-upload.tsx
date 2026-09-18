"use client";

import { useState } from "react";

import { fileSize } from "@/lib/upload";
import { ProgressBar } from "./progress";

/**
 * Mengirim satu berkas ke tautan unggah bertanda tangan.
 *
 * XMLHttpRequest, bukan fetch: hanya yang pertama melaporkan kemajuan
 * pengiriman. Pada berkas puluhan megabita lewat jaringan kantor, tombol yang
 * diam selama satu menit akan ditekan ulang orang — dan pengiriman kedua itu
 * membatalkan yang pertama.
 */
export function putFile(
  url: string,
  file: File,
  onProgress: (ratio: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("x-upsert", "true");
    if (file.type) request.setRequestHeader("content-type", file.type);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    request.addEventListener("load", () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(
            new Error(
              "Berkas gagal diunggah ke penyimpanan. Periksa koneksi Anda lalu coba kembali.",
            ),
          ),
    );
    request.addEventListener("error", () =>
      reject(new Error("Sambungan ke penyimpanan terputus saat mengunggah.")),
    );
    request.addEventListener("abort", () =>
      reject(new Error("Unggahan dibatalkan.")),
    );
    request.send(file);
  });
}

/** Keadaan satu unggahan, dipakai bersama oleh formulir materi dan tugas. */
export function useUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  return {
    progress,
    /** Menjalankan unggahan sambil melaporkan kemajuannya. */
    async run(url: string, file: File) {
      setProgress(0);
      try {
        await putFile(url, file, setProgress);
      } finally {
        setProgress(null);
      }
    },
    busy: progress !== null,
  };
}

export function UploadProgress({
  progress,
  file,
}: {
  progress: number | null;
  file?: File | null;
}) {
  if (progress === null) return null;
  return (
    <ProgressBar
      value={progress * 100}
      label={
        file ? `Mengunggah ${file.name} · ${fileSize(file.size)}` : "Mengunggah"
      }
    />
  );
}
