-- Isi pelajaran menjadi deretan blok (teks berformat, video, gambar, berkas,
-- tautan, catatan) pada satu kolom JSON.
--
-- Isi lama dipindahkan lebih dulu sebelum kolomnya dihapus: teks biasa
-- di-escape lalu dibungkus paragraf, dan tautan materi menjadi blok video
-- (untuk pelajaran berjenis VIDEO) atau blok tautan. Tampilan pelajaran lama
-- bagi peserta tetap sama isinya.
BEGIN;

ALTER TABLE "Lesson" ADD COLUMN "blocks" JSONB NOT NULL DEFAULT '[]';

UPDATE "Lesson" SET "blocks" =
  (CASE WHEN btrim("content") <> '' THEN jsonb_build_array(jsonb_build_object(
    'id', 'legacy-text',
    'type', 'text',
    'html', '<p>' || replace(replace(
      replace(replace(replace(replace(btrim("content"), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\r\n', E'\n'),
      E'\n\n', '</p><p>'), E'\n', '<br>') || '</p>'
  )) ELSE '[]'::jsonb END)
  ||
  (CASE
    WHEN coalesce(btrim("resourceUrl"), '') = '' THEN '[]'::jsonb
    WHEN "type" = 'VIDEO' THEN jsonb_build_array(jsonb_build_object(
      'id', 'legacy-video', 'type', 'video', 'url', btrim("resourceUrl"),
      'file', NULL, 'caption', ''))
    ELSE jsonb_build_array(jsonb_build_object(
      'id', 'legacy-link', 'type', 'link', 'url', btrim("resourceUrl"),
      'title', 'Buka materi', 'description', ''))
  END);

ALTER TABLE "Lesson" DROP COLUMN "content";
ALTER TABLE "Lesson" DROP COLUMN "resourceUrl";

COMMIT;
