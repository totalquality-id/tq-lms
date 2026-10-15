import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Membersihkan HTML dari editor teks sebelum disimpan.
 *
 * Isi pelajaran ditampilkan ke setiap peserta apa adanya, jadi yang tersimpan
 * hanya tag dan atribut yang memang dihasilkan editor. Skrip, gaya bebas,
 * iframe, dan penangan event dibuang di server — pemeriksaan di peramban
 * dapat dilewati siapa pun yang memanggil aksinya langsung.
 */
export function cleanRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "h4",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "colgroup",
      "col",
      "mark",
      "sub",
      "sup",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      ol: ["start"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          href: attribs.href ?? "",
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  }).trim();
}
