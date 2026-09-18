import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RESOURCE_MAX_BYTES,
  extensionOf,
  fileNameOf,
  fileSize,
  mimeOf,
  safeFileName,
  storageKey,
  uploadError,
} from "@/lib/upload";

const MB = 1024 * 1024;

test("extensions are read from the last dot, in lower case", () => {
  assert.equal(extensionOf("Laporan Audit.PDF"), "pdf");
  assert.equal(extensionOf("arsip.tar.gz"), "gz");
  assert.equal(extensionOf("tanpa-ekstensi"), "");
  // Berkas tersembunyi bergaya Unix bukan ekstensi: namanya memang diawali titik.
  assert.equal(extensionOf(".gitignore"), "");
});

test("an accepted file passes", () => {
  assert.equal(uploadError("materi.pdf", 2 * MB, RESOURCE_MAX_BYTES), null);
  assert.equal(uploadError("rekap.xlsx", 512, RESOURCE_MAX_BYTES), null);
});

test("executables are refused whatever they are named", () => {
  for (const name of ["setup.exe", "skrip.sh", "makro.bat", "pustaka.dll"])
    assert.match(
      uploadError(name, 1024, RESOURCE_MAX_BYTES) ?? "",
      /tidak diterima/,
    );
});

test("size is refused with the limit spelled out", () => {
  const message = uploadError(
    "besar.pdf",
    RESOURCE_MAX_BYTES + 1,
    RESOURCE_MAX_BYTES,
  );
  assert.match(message ?? "", /melebihi batas 25 MB/);
  assert.equal(
    uploadError("kosong.pdf", 0, RESOURCE_MAX_BYTES),
    "Berkas kosong tidak dapat diunggah.",
  );
});

test("a per-assignment allowlist narrows what is accepted", () => {
  assert.equal(uploadError("tugas.pdf", 1024, 10 * MB, ["pdf"]), null);
  assert.match(
    uploadError("tugas.zip", 1024, 10 * MB, ["pdf"]) ?? "",
    /\.zip tidak diterima/,
  );
});

test("the stored MIME type follows the extension, not the browser", () => {
  assert.equal(mimeOf("materi.pdf"), "application/pdf");
  assert.equal(mimeOf("gambar.JPEG"), "image/jpeg");
  assert.equal(mimeOf("entah.xyz"), "application/octet-stream");
});

test("file names are reduced to one safe path segment", () => {
  assert.equal(safeFileName("Materi ISO 27001.pdf"), "Materi-ISO-27001.pdf");
  assert.equal(safeFileName("../../etc/passwd.txt"), "etc-passwd.txt");
  assert.equal(safeFileName("a/b/c.docx"), "a-b-c.docx");
  // Nama yang tidak menyisakan satu pun karakter aman tetap punya nama.
  assert.equal(safeFileName("---.pdf"), "berkas.pdf");
  assert.ok(safeFileName(`${"n".repeat(300)}.pdf`).length <= 84);
});

test("a storage key nests the file under a server-made directory", () => {
  const key = storageKey(["batch", "b1", "resource"], "u-1", "Materi Awal.pdf");
  assert.equal(key, "batch/b1/resource/u-1/Materi-Awal.pdf");
  assert.equal(fileNameOf(key), "Materi-Awal.pdf");

  // Nama berkas tidak pernah dapat keluar dari awalan kelasnya, sehingga
  // pemeriksaan awalan pada confirmUpload tidak dapat ditipu dari peramban.
  const hostile = storageKey(
    ["batch", "b1", "resource"],
    "u-2",
    "../../b2/curi.pdf",
  );
  assert.ok(hostile.startsWith("batch/b1/resource/u-2/"));
  assert.ok(!hostile.includes(".."));
});

test("sizes are written the way people read them", () => {
  assert.equal(fileSize(900), "900 B");
  assert.equal(fileSize(2048), "2.0 KB");
  assert.equal(fileSize(5 * MB), "5.0 MB");
  assert.equal(fileSize(25 * MB), "25 MB");
});
