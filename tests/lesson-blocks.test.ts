import assert from "node:assert/strict";
import { test } from "node:test";

import {
  blocksError,
  lessonFileUrl,
  primaryType,
  readBlocks,
  videoEmbedUrl,
  type LessonBlock,
} from "@/lib/lesson-blocks";

const file = (name: string) => ({ key: `lessons/c1/u1/${name}`, name, size: 10 });

test("YouTube links in every common shape become nocookie embeds", () => {
  const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
  assert.equal(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), embed);
  assert.equal(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ"), embed);
  assert.equal(videoEmbedUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ"), embed);
  assert.equal(videoEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"), embed);
});

test("Vimeo and Google Drive links are embedded, unlisted hash kept", () => {
  assert.equal(
    videoEmbedUrl("https://vimeo.com/76979871"),
    "https://player.vimeo.com/video/76979871",
  );
  assert.equal(
    videoEmbedUrl("https://vimeo.com/76979871/abc123def4"),
    "https://player.vimeo.com/video/76979871?h=abc123def4",
  );
  assert.equal(
    videoEmbedUrl("https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing"),
    "https://drive.google.com/file/d/1AbCdEfGhIjK/preview",
  );
});

test("unknown hosts, plain http, and junk are never embedded", () => {
  assert.equal(videoEmbedUrl("https://evil.example/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(videoEmbedUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(videoEmbedUrl("javascript:alert(1)"), null);
  assert.equal(videoEmbedUrl("https://www.youtube.com/watch?v=<script>"), null);
});

test("stored blocks are read leniently: invalid items are skipped", () => {
  const blocks = readBlocks([
    { id: "a", type: "text", html: "<p>Halo</p>" },
    { id: "b", type: "unknown" },
    { id: "c", type: "callout", text: "Ingat" },
    "rusak",
  ]);
  assert.deepEqual(
    blocks.map((block) => block.id),
    ["a", "c"],
  );
  assert.deepEqual(readBlocks(null), []);
});

test("validation names the first incomplete block", () => {
  const blocks: LessonBlock[] = [
    { id: "a", type: "text", html: "<p>Isi</p>" },
    { id: "b", type: "image", file: file("foto.png"), alt: "", caption: "" },
  ];
  assert.match(blocksError(blocks) ?? "", /Blok 2 \(Gambar\).*teks alternatif/);
  assert.match(
    blocksError([{ id: "a", type: "text", html: "<p> </p>" }]) ?? "",
    /Blok 1 \(Teks\) masih kosong/,
  );
  assert.match(
    blocksError([{ id: "v", type: "video", url: "https://example.com/v.mp4", file: null, caption: "" }]) ?? "",
    /YouTube, Vimeo, atau Google Drive/,
  );
  assert.equal(
    blocksError([{ id: "v", type: "video", url: "", file: file("klip.mp4"), caption: "" }]),
    null,
  );
});

test("the lesson label follows the first media block", () => {
  assert.equal(primaryType([{ id: "a", type: "text", html: "<p>x</p>" }]), "TEXT");
  assert.equal(
    primaryType([
      { id: "a", type: "text", html: "<p>x</p>" },
      { id: "b", type: "file", file: file("modul.pdf"), title: "", description: "" },
      { id: "c", type: "video", url: "https://youtu.be/dQw4w9WgXcQ", file: null, caption: "" },
    ]),
    "PDF",
  );
  assert.equal(
    primaryType([{ id: "b", type: "file", file: file("slide.pptx"), title: "", description: "" }]),
    "FILE",
  );
});

test("file links go through the authorised lesson route", () => {
  assert.equal(
    lessonFileUrl("l1", file("modul.pdf"), true),
    "/api/files/lesson/l1?key=lessons%2Fc1%2Fu1%2Fmodul.pdf&download=1",
  );
});
